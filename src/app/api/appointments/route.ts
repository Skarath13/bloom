import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

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
    // Dates are stored in UTC, query using ISO date strings with PST offset
    if (date) {
      // Create start and end of day in PST (UTC-8)
      const dayStart = new Date(`${date}T00:00:00-08:00`);
      const dayEnd = new Date(`${date}T23:59:59.999-08:00`);
      query = query
        .gte("startTime", dayStart.toISOString())
        .lte("startTime", dayEnd.toISOString());
    } else if (startDate && endDate) {
      const rangeStart = new Date(`${startDate}T00:00:00-08:00`);
      const rangeEnd = new Date(`${endDate}T23:59:59.999-08:00`);
      query = query
        .gte("startTime", rangeStart.toISOString())
        .lte("startTime", rangeEnd.toISOString());
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error("Fetch appointments error:", error);
      console.error("Query params:", { locationId, technicianId, date, startDate, endDate, status });
      return NextResponse.json(
        { error: "Failed to fetch appointments", details: error.message },
        { status: 500 }
      );
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
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Create appointment
    const appointmentId = generateId();
    const now = new Date().toISOString();

    const { data: appointment, error: createError } = await supabase
      .from(tables.appointments)
      .insert({
        id: appointmentId,
        clientId,
        technicianId,
        locationId,
        serviceId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        status,
        notes: notes || null,
        noShowProtected,
        noShowFeeCharged: false,
        noShowFeeAmount: null,
        noShowChargedAt: null,
        depositAmount: service.depositAmount,
        depositPaidAt: null,
        stripePaymentIntentId: null,
        reminder24hSent: false,
        reminder2hSent: false,
        confirmedAt: status === "CONFIRMED" ? now : null,
        cancelledAt: null,
        cancellationReason: null,
        recurringAppointmentId: null,
        createdAt: now,
        updatedAt: now,
      })
      .select(`
        *,
        bloom_clients (*),
        bloom_services (*),
        bloom_technicians (*),
        bloom_locations (*)
      `)
      .single();

    if (createError) {
      console.error("Create appointment error:", createError);
      return NextResponse.json(
        { error: "Failed to create appointment" },
        { status: 500 }
      );
    }

    // Transform response
    const transformedAppointment = {
      ...appointment,
      client: appointment.bloom_clients || null,
      service: appointment.bloom_services || null,
      technician: appointment.bloom_technicians || null,
      location: appointment.bloom_locations || null,
      bloom_clients: undefined,
      bloom_services: undefined,
      bloom_technicians: undefined,
      bloom_locations: undefined,
    };

    return NextResponse.json({
      success: true,
      appointment: transformedAppointment,
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
