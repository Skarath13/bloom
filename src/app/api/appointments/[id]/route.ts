import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { createRefund } from "@/lib/stripe";
import { sendCancellationNotification } from "@/lib/twilio";
import { differenceInHours } from "date-fns";
import {
  updateAppointmentWithCheck,
  AppointmentConflictError,
  AppointmentNotFoundError,
  AppointmentStaleError,
} from "@/lib/appointments";

interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  stripeCustomerId: string | null;
  bloom_payment_methods: PaymentMethod[];
}

interface ServiceData {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

interface TechnicianData {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface LocationData {
  id: string;
  name: string;
  city: string;
}

interface AppointmentWithRelations {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  stripePaymentIntentId: string | null;
  depositAmount: number;
  depositPaidAt: string | null;
  bloom_clients: ClientData | null;
  bloom_services: ServiceData | null;
  bloom_technicians: TechnicianData | null;
  bloom_locations: LocationData | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: appointment, error } = await supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_clients (
          *,
          bloom_payment_methods (*)
        ),
        bloom_services (*),
        bloom_technicians (*),
        bloom_locations (*)
      `)
      .eq("id", id)
      .single() as { data: AppointmentWithRelations | null; error: unknown };

    if (error || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Transform to expected format
    const transformed = {
      ...appointment,
      client: appointment.bloom_clients
        ? {
            ...appointment.bloom_clients,
            paymentMethods: appointment.bloom_clients.bloom_payment_methods || [],
          }
        : null,
      service: appointment.bloom_services || null,
      technician: appointment.bloom_technicians || null,
      location: appointment.bloom_locations || null,
    };

    return NextResponse.json({ appointment: transformed });
  } catch (error) {
    console.error("Fetch appointment error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/appointments/[id]
 * Update an appointment with conflict checking and optimistic locking
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Use the safe update function with conflict checking
    const appointment = await updateAppointmentWithCheck({
      appointmentId: id,
      expectedUpdatedAt: body.expectedUpdatedAt, // For optimistic locking
      data: {
        technicianId: body.technicianId,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        status: body.status,
        notes: body.notes,
      },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("Update appointment error:", error);

    // Handle specific error types
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          conflict: error.conflict,
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    if (error instanceof AppointmentStaleError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "STALE",
        },
        { status: 409 }
      );
    }

    if (error instanceof AppointmentNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const forceRefund = searchParams.get("forceRefund") === "true";

    // Get appointment with client and service
    const { data: appointment, error: fetchError } = await supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_clients (*),
        bloom_services (*)
      `)
      .eq("id", id)
      .single() as { data: AppointmentWithRelations | null; error: unknown };

    if (fetchError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check cancellation policy (6 hours)
    const hoursUntilAppointment = differenceInHours(
      new Date(appointment.startTime),
      new Date()
    );
    const canRefund = hoursUntilAppointment >= 6 || forceRefund;

    // Process refund if eligible and payment was made
    let refundAmount = 0;
    if (canRefund && appointment.stripePaymentIntentId && appointment.depositPaidAt) {
      try {
        await createRefund(appointment.stripePaymentIntentId);
        refundAmount = Number(appointment.depositAmount);
      } catch (refundError) {
        console.error("Refund failed:", refundError);
        // Continue with cancellation even if refund fails
      }
    }

    // Update appointment status
    const { error: updateError } = await supabase
      .from(tables.appointments)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({
        status: "CANCELLED",
        cancelledAt: new Date().toISOString(),
        cancellationReason: forceRefund
          ? "Cancelled by admin with refund"
          : canRefund
          ? "Cancelled by client (more than 6 hours notice)"
          : "Cancelled by client (deposit forfeited)",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Cancel appointment error:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel appointment" },
        { status: 500 }
      );
    }

    // Send cancellation SMS
    if (appointment.bloom_clients && appointment.bloom_services) {
      try {
        await sendCancellationNotification({
          phone: appointment.bloom_clients.phone,
          clientName: appointment.bloom_clients.firstName,
          serviceName: appointment.bloom_services.name,
          dateTime: new Date(appointment.startTime),
          refundAmount: canRefund ? refundAmount : undefined,
        });
      } catch (smsError) {
        console.error("Failed to send cancellation SMS:", smsError);
        // Don't fail the request if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      refunded: canRefund && refundAmount > 0,
      refundAmount,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json(
      { error: "Failed to cancel appointment" },
      { status: 500 }
    );
  }
}
