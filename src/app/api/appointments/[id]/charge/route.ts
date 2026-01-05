import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { chargeNoShowFee } from "@/lib/stripe";

interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  isDefault: boolean;
}

interface ClientWithPayments {
  id: string;
  firstName: string;
  lastName: string;
  stripeCustomerId: string | null;
  bloom_payment_methods: PaymentMethod[];
}

interface AppointmentWithRelations {
  id: string;
  noShowFeeCharged: boolean;
  bloom_clients: ClientWithPayments | null;
  bloom_services: { name: string } | null;
  bloom_technicians: { firstName: string } | null;
  bloom_locations: { name: string } | null;
}

/**
 * POST /api/appointments/[id]/charge
 * Charge a no-show or late cancellation fee for an appointment
 *
 * Uses atomic update to prevent double-charging race condition
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const { amount, reason } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Get appointment with client and service info
    const { data: appointment, error: fetchError } = await supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_clients (
          id,
          firstName,
          lastName,
          stripeCustomerId,
          bloom_payment_methods (
            id,
            stripePaymentMethodId,
            isDefault
          )
        ),
        bloom_services (name),
        bloom_technicians (firstName),
        bloom_locations (name)
      `)
      .eq("id", appointmentId)
      .single() as { data: AppointmentWithRelations | null; error: unknown };

    if (fetchError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check if already charged (initial check - definitive check happens atomically below)
    if (appointment.noShowFeeCharged) {
      return NextResponse.json(
        { error: "No-show fee already charged for this appointment" },
        { status: 400 }
      );
    }

    const client = appointment.bloom_clients;
    const paymentMethods = client?.bloom_payment_methods || [];
    const defaultPaymentMethod = paymentMethods.find((pm: { isDefault: boolean }) => pm.isDefault) || paymentMethods[0];

    // Check if client has Stripe customer and payment method
    if (!client?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client has no payment method on file" },
        { status: 400 }
      );
    }

    if (!defaultPaymentMethod) {
      return NextResponse.json(
        { error: "Client has no payment method on file" },
        { status: 400 }
      );
    }

    // CRITICAL: Atomically mark as "charging in progress" to prevent race conditions
    // This uses optimistic locking - only succeeds if noShowFeeCharged is still false
    const { data: lockResult, error: lockError } = await supabase
      .from(tables.appointments)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({
        noShowFeeCharged: true, // Mark as charged BEFORE charging to prevent race
        noShowFeeAmount: amount,
        noShowChargedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .eq("noShowFeeCharged", false) // Only update if not already charged
      .select("id")
      .single() as { data: { id: string } | null; error: unknown };

    if (lockError || !lockResult) {
      // Another request already marked this as charged
      return NextResponse.json(
        { error: "No-show fee already charged for this appointment" },
        { status: 400 }
      );
    }

    // Build description
    const chargeReason = reason || "No-show fee";
    const description = `${chargeReason} - ${appointment.bloom_services?.name || "Service"} with ${appointment.bloom_technicians?.firstName || "Technician"} at ${appointment.bloom_locations?.name || "Location"}`;

    try {
      // Charge the card
      const paymentIntent = await chargeNoShowFee({
        customerId: client.stripeCustomerId,
        paymentMethodId: defaultPaymentMethod.stripePaymentMethodId,
        amount,
        appointmentId,
        description,
      });

      // Update with payment intent ID
      await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          stripePaymentIntentId: paymentIntent.id,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        amount,
        message: `Successfully charged $${amount.toFixed(2)} for ${chargeReason.toLowerCase()}`,
      });
    } catch (chargeError) {
      // Stripe charge failed - rollback the "charged" flag
      await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          noShowFeeCharged: false,
          noShowFeeAmount: null,
          noShowChargedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      throw chargeError;
    }
  } catch (error) {
    console.error("Charge no-show fee error:", error);

    // Handle Stripe-specific errors
    if (error instanceof Error && error.message.includes("card")) {
      return NextResponse.json(
        { error: `Card declined: ${error.message}` },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "Failed to charge no-show fee" },
      { status: 500 }
    );
  }
}
