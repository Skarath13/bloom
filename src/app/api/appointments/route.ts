import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import {
  createAppointmentWithCheck,
  AppointmentConflictError,
} from "@/lib/appointments";
import { sendBookingConfirmation } from "@/lib/twilio";
import { differenceInHours } from "date-fns";

interface PaymentMethod {
  id: string;
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
  phoneVerified: boolean;
  isBlocked: boolean;
  stripeCustomerId: string | null;
  bloom_payment_methods: PaymentMethod[];
}

interface ServiceData {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
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
  clientId: string;
  startTime: string;
  endTime: string;
  status: string;
  bookedAnyAvailable: boolean;
  bloom_clients: ClientData | null;
  bloom_services: ServiceData | null;
  bloom_technicians: TechnicianData | null;
  bloom_locations: LocationData | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const technicianId = searchParams.get("technicianId");
    const date = searchParams.get("date"); // YYYY-MM-DD format
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    // Build the query with all relations
    let query = supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_clients (
          id,
          firstName,
          lastName,
          phone,
          email,
          phoneVerified,
          isBlocked,
          stripeCustomerId,
          bloom_payment_methods (
            id,
            brand,
            last4,
            isDefault
          )
        ),
        bloom_services (
          id,
          name,
          category,
          durationMinutes,
          price
        ),
        bloom_technicians (
          id,
          firstName,
          lastName,
          color
        ),
        bloom_locations (
          id,
          name,
          city
        )
      `)
      .order("startTime", { ascending: true });

    // Apply filters
    if (locationId) {
      query = query.eq("locationId", locationId);
    }

    if (technicianId) {
      query = query.eq("technicianId", technicianId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    // Handle date filtering
    // Column is "timestamp without time zone" - query using local time strings directly
    if (date) {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59.999`;
      query = query
        .gte("startTime", dayStart)
        .lte("startTime", dayEnd);
    } else if (startDate && endDate) {
      const rangeStart = `${startDate}T00:00:00`;
      const rangeEnd = `${endDate}T23:59:59.999`;
      query = query
        .gte("startTime", rangeStart)
        .lte("startTime", rangeEnd);
    }

    const { data: appointments, error } = await query as { data: AppointmentWithRelations[] | null; error: { message: string } | null };

    if (error) {
      console.error("Fetch appointments error:", error);
      console.error("Query params:", { locationId, technicianId, date, startDate, endDate, status });
      return NextResponse.json(
        { error: "Failed to fetch appointments", details: error.message },
        { status: 500 }
      );
    }

    // Compute linked appointments (same client, same day) for duplicate detection
    // Group appointments by clientId + date
    const appointmentsByClientDate: Record<string, AppointmentWithRelations[]> = {};
    for (const apt of appointments || []) {
      const dateKey = apt.startTime.slice(0, 10); // YYYY-MM-DD
      const key = `${apt.clientId}-${dateKey}`;
      if (!appointmentsByClientDate[key]) {
        appointmentsByClientDate[key] = [];
      }
      appointmentsByClientDate[key].push(apt);
    }

    // For each appointment, check for earlier/later same-day appointments
    const linkedAppointmentFlags: Record<string, { hasEarlier: boolean; hasLater: boolean }> = {};
    for (const [, apts] of Object.entries(appointmentsByClientDate)) {
      if (apts.length > 1) {
        // Sort by start time
        const sorted = apts.sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 0; i < sorted.length; i++) {
          linkedAppointmentFlags[sorted[i].id] = {
            hasEarlier: i > 0,
            hasLater: i < sorted.length - 1,
          };
        }
      }
    }

    // Compute isNewClient for each appointment
    // A client is "new" if this appointment is their first valid (non-cancelled, non-no-show) appointment
    const clientIds = [...new Set(appointments?.map((apt) => apt.clientId).filter(Boolean) || [])];
    const earliestValidAppointmentByClient: Record<string, string> = {};

    if (clientIds.length > 0) {
      // For each client, find their earliest valid appointment
      const { data: earliestAppointments } = await supabase
        .from(tables.appointments)
        .select("id, clientId, startTime, status")
        .in("clientId", clientIds)
        .not("status", "in", '("CANCELLED","NO_SHOW")')
        .order("startTime", { ascending: true });

      // Build map of clientId -> earliest valid appointment ID
      if (earliestAppointments) {
        for (const apt of earliestAppointments) {
          if (!earliestValidAppointmentByClient[apt.clientId]) {
            earliestValidAppointmentByClient[apt.clientId] = apt.id;
          }
        }
      }
    }

    // Transform the response to match the expected format
    const transformedAppointments = appointments?.map((apt) => ({
      ...apt,
      client: apt.bloom_clients
        ? {
            ...apt.bloom_clients,
            paymentMethods: apt.bloom_clients.bloom_payment_methods || [],
          }
        : null,
      service: apt.bloom_services || null,
      technician: apt.bloom_technicians || null,
      location: apt.bloom_locations || null,
      // Computed field: is this the client's first valid appointment?
      isNewClient: earliestValidAppointmentByClient[apt.clientId] === apt.id,
      // Transform snake_case DB field to camelCase
      bookedAnyAvailable: (apt as unknown as { booked_any_available?: boolean }).booked_any_available ?? false,
      // Linked appointment flags (same client, same day)
      hasEarlierAppointment: linkedAppointmentFlags[apt.id]?.hasEarlier ?? false,
      hasLaterAppointment: linkedAppointmentFlags[apt.id]?.hasLater ?? false,
      // Remove the raw relation fields
      bloom_clients: undefined,
      bloom_services: undefined,
      bloom_technicians: undefined,
      bloom_locations: undefined,
    }));

    return NextResponse.json({ appointments: transformedAppointments || [] });
  } catch (error) {
    console.error("Fetch appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments
 * Create a new appointment (admin manual booking)
 * Uses conflict checking to prevent double-booking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      technicianId,
      locationId,
      serviceId,
      startTime,
      endTime,
      status = "CONFIRMED",
      notes,
      noShowProtected = false,
      bookedBy,
      bookedAnyAvailable = false,
    } = body;

    // Validate required fields
    if (!clientId || !technicianId || !locationId || !serviceId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get service to calculate deposit amount
    const { data: service, error: serviceError } = await supabase
      .from(tables.services)
      .select("*")
      .eq("id", serviceId)
      .single() as { data: ServiceData | null; error: unknown };

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Check if appointment is within 6 hours - auto-confirm if so (no time for reminder flow)
    const appointmentStartTime = new Date(startTime);
    const hoursUntilAppointment = differenceInHours(appointmentStartTime, new Date());
    const isWithin6Hours = hoursUntilAppointment < 6;

    // Create appointment with conflict checking
    const appointment = await createAppointmentWithCheck({
      clientId,
      technicianId,
      locationId,
      serviceId,
      startTime: appointmentStartTime,
      endTime: new Date(endTime),
      status: status as "PENDING" | "CONFIRMED",
      notes: notes || null,
      noShowProtected,
      bookedBy: bookedBy || "Admin",
      depositAmount: service.depositAmount,
      bookedAnyAvailable,
    });

    // If within 6 hours, update to auto-confirm (skip SMS confirmation flow)
    if (isWithin6Hours && appointment.id) {
      await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          smsConfirmedAt: new Date().toISOString(),
          smsConfirmedBy: "auto",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", appointment.id);
    }

    // Send booking confirmation SMS
    if (appointment.client?.phone) {
      try {
        await sendBookingConfirmation({
          phone: appointment.client.phone,
          clientName: appointment.client.firstName || "there",
          dateTime: appointmentStartTime,
        });
      } catch (smsError) {
        console.error("Failed to send booking confirmation SMS:", smsError);
        // Don't fail the booking if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      appointment,
    });
  } catch (error) {
    console.error("Create appointment error:", error);

    // Handle conflict error specifically
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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create appointment" },
      { status: 500 }
    );
  }
}
