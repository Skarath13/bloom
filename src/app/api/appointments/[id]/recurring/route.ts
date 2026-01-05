import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import { addWeeks, addMonths, format } from "date-fns";

type RecurrencePattern = "weekly" | "biweekly" | "every3weeks" | "monthly";

interface AppointmentRow {
  id: string;
  clientId: string;
  technicianId: string;
  locationId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: string;
  depositAmount: number;
  notes: string | null;
  recurringAppointmentId: string | null;
}

interface RecurringAppointment {
  id: string;
  appointmentId: string;
  clientId: string;
  technicianId: string;
  locationId: string;
  serviceId: string;
  recurrencePattern: RecurrencePattern;
  dayOfWeek: number;
  preferredTime: string;
  startDate: string;
  endDate: string | null;
  occurrences: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/appointments/[id]/recurring
 * Get recurring appointment settings for an appointment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;

    // Get the appointment to find its recurring settings
    const { data: appointment, error: aptError } = await supabase
      .from(tables.appointments)
      .select("recurringAppointmentId")
      .eq("id", appointmentId)
      .single() as { data: { recurringAppointmentId: string | null } | null; error: unknown };

    if (aptError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (!appointment.recurringAppointmentId) {
      return NextResponse.json({ recurring: null });
    }

    // Get the recurring settings
    const { data: recurring, error } = await supabase
      .from(tables.recurringAppointments)
      .select("*")
      .eq("id", appointment.recurringAppointmentId)
      .single() as { data: RecurringAppointment | null; error: unknown };

    if (error) {
      console.error("Failed to fetch recurring settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch recurring settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ recurring });
  } catch (error) {
    console.error("Get recurring settings error:", error);
    return NextResponse.json(
      { error: "Failed to get recurring settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments/[id]/recurring
 * Set up recurring appointments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const body = await request.json();

    const {
      recurrencePattern,
      occurrences = 12, // Default to 12 occurrences
      endDate,
    } = body;

    if (!recurrencePattern) {
      return NextResponse.json(
        { error: "recurrencePattern is required" },
        { status: 400 }
      );
    }

    // Get the original appointment
    const { data: appointment, error: aptError } = await supabase
      .from(tables.appointments)
      .select("*")
      .eq("id", appointmentId)
      .single() as { data: AppointmentRow | null; error: unknown };

    if (aptError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();

    // Create recurring appointment record
    const recurringId = generateId();
    const recurringData: Partial<RecurringAppointment> = {
      id: recurringId,
      appointmentId,
      clientId: appointment.clientId,
      technicianId: appointment.technicianId,
      locationId: appointment.locationId,
      serviceId: appointment.serviceId,
      recurrencePattern,
      dayOfWeek: startTime.getDay(),
      preferredTime: format(startTime, "HH:mm"),
      startDate: appointment.startTime,
      endDate: endDate || null,
      occurrences,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error: createError } = await supabase
      .from(tables.recurringAppointments)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert(recurringData);

    if (createError) {
      console.error("Failed to create recurring appointment:", createError);
      return NextResponse.json(
        { error: "Failed to create recurring appointment" },
        { status: 500 }
      );
    }

    // Update original appointment with recurring ID
    await supabase
      .from(tables.appointments)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({
        recurringAppointmentId: recurringId,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    // Generate future appointments
    const futureAppointments: Array<{
      id: string;
      startTime: string;
      endTime: string;
    }> = [];

    let currentDate = startTime;
    for (let i = 1; i < occurrences; i++) {
      // Calculate next occurrence
      switch (recurrencePattern) {
        case "weekly":
          currentDate = addWeeks(currentDate, 1);
          break;
        case "biweekly":
          currentDate = addWeeks(currentDate, 2);
          break;
        case "every3weeks":
          currentDate = addWeeks(currentDate, 3);
          break;
        case "monthly":
          currentDate = addMonths(currentDate, 1);
          break;
      }

      // Check if we've passed the end date
      if (endDate && currentDate > new Date(endDate)) {
        break;
      }

      const newEndTime = new Date(currentDate.getTime() + durationMs);

      // Create the future appointment
      const futureAptId = generateId();
      const { error: insertError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .insert({
          id: futureAptId,
          clientId: appointment.clientId,
          technicianId: appointment.technicianId,
          locationId: appointment.locationId,
          serviceId: appointment.serviceId,
          startTime: currentDate.toISOString(),
          endTime: newEndTime.toISOString(),
          status: "CONFIRMED",
          depositAmount: appointment.depositAmount,
          depositPaidAt: null, // Future appointments may need separate deposit handling
          noShowProtected: false,
          noShowFeeCharged: false,
          reminder24hSent: false,
          reminder2hSent: false,
          notes: appointment.notes,
          recurringAppointmentId: recurringId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      if (!insertError) {
        futureAppointments.push({
          id: futureAptId,
          startTime: currentDate.toISOString(),
          endTime: newEndTime.toISOString(),
        });
      }
    }

    return NextResponse.json({
      recurring: recurringData,
      appointmentsCreated: futureAppointments.length,
      futureAppointments,
    });
  } catch (error) {
    console.error("Create recurring error:", error);
    return NextResponse.json(
      { error: "Failed to create recurring appointments" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/appointments/[id]/recurring
 * Cancel recurring appointments
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const { searchParams } = new URL(request.url);
    const cancelAll = searchParams.get("cancelAll") === "true";

    // Get the appointment to find its recurring ID
    const { data: appointment, error: aptError } = await supabase
      .from(tables.appointments)
      .select("recurringAppointmentId")
      .eq("id", appointmentId)
      .single() as { data: { recurringAppointmentId: string | null } | null; error: unknown };

    if (aptError || !appointment?.recurringAppointmentId) {
      return NextResponse.json(
        { error: "No recurring settings found for this appointment" },
        { status: 404 }
      );
    }

    const recurringId = appointment.recurringAppointmentId;

    if (cancelAll) {
      // Cancel all future appointments in the series
      const now = new Date().toISOString();
      const { data: futureApts } = await supabase
        .from(tables.appointments)
        .select("id")
        .eq("recurringAppointmentId", recurringId)
        .gt("startTime", now)
        .neq("status", "CANCELLED") as { data: { id: string }[] | null; error: unknown };

      if (futureApts && futureApts.length > 0) {
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            status: "CANCELLED",
            cancelledAt: now,
            cancellationReason: "Recurring series cancelled",
            updatedAt: now,
          })
          .in("id", futureApts.map(a => a.id));
      }

      // Deactivate the recurring record
      await supabase
        .from(tables.recurringAppointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          isActive: false,
          updatedAt: now,
        })
        .eq("id", recurringId);

      return NextResponse.json({
        success: true,
        cancelledCount: futureApts?.length || 0,
      });
    } else {
      // Just remove this appointment from the recurring series
      await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          recurringAppointmentId: null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      return NextResponse.json({
        success: true,
        removedFromSeries: true,
      });
    }
  } catch (error) {
    console.error("Delete recurring error:", error);
    return NextResponse.json(
      { error: "Failed to cancel recurring appointments" },
      { status: 500 }
    );
  }
}
