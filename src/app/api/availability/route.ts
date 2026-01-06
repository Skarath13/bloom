import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore, isAfter, setHours, setMinutes } from "date-fns";

interface TimeSlot {
  time: string;
  available: boolean;
  technicianId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const serviceId = searchParams.get("serviceId");
    const technicianId = searchParams.get("technicianId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD format

    if (!locationId || !serviceId || !dateStr) {
      return NextResponse.json(
        { error: "Missing required parameters: locationId, serviceId, date" },
        { status: 400 }
      );
    }

    const date = parse(dateStr, "yyyy-MM-dd", new Date());
    const dayOfWeek = date.getDay();

    // Get service duration
    const { data: service, error: serviceError } = await supabase
      .from(tables.services)
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const serviceDuration = service.durationMinutes;

    // Get technicians for the location (or specific technician)
    let techQuery = supabase
      .from(tables.technicians)
      .select("*")
      .eq("locationId", locationId)
      .eq("isActive", true);

    if (technicianId && technicianId !== "any") {
      techQuery = techQuery.eq("id", technicianId);
    }

    const { data: technicians, error: techError } = await techQuery;

    if (techError) throw techError;

    // Get schedules for these technicians
    const techIds = technicians?.map((t) => t.id) || [];
    const { data: schedules } = await supabase
      .from(tables.technicianSchedules)
      .select("*")
      .in("technicianId", techIds)
      .eq("dayOfWeek", dayOfWeek);

    // Get blocks for these technicians
    const { data: blocks } = await supabase
      .from(tables.technicianBlocks)
      .select("*")
      .in("technicianId", techIds)
      .eq("isActive", true);

    // Get existing appointments for the date
    let apptQuery = supabase
      .from(tables.appointments)
      .select("*")
      .eq("locationId", locationId)
      .gte("startTime", startOfDay(date).toISOString())
      .lte("startTime", endOfDay(date).toISOString())
      .not("status", "in", '("CANCELLED","NO_SHOW")');

    if (technicianId && technicianId !== "any") {
      apptQuery = apptQuery.eq("technicianId", technicianId);
    }

    const { data: existingAppointments } = await apptQuery;

    // Map schedules and blocks to technicians
    const techsWithData = technicians?.map((tech) => ({
      ...tech,
      schedules: schedules?.filter((s) => s.technicianId === tech.id) || [],
      blocks: blocks?.filter((b) => b.technicianId === tech.id) || [],
    })) || [];

    // Generate time slots (9 AM to 6 PM, every 15 minutes)
    const slots: TimeSlot[] = [];
    const now = new Date();

    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        // Last appointment should fit within closing time
        if (hour === 18 && minute > 0) break;

        const slotStart = setMinutes(setHours(startOfDay(date), hour), minute);
        const slotEnd = addMinutes(slotStart, serviceDuration);

        // Skip if slot is in the past
        if (isBefore(slotStart, now)) continue;

        // Skip if appointment would extend past 7 PM
        if (isAfter(slotEnd, setHours(startOfDay(date), 19))) continue;

        // Check availability for each technician
        let available = false;
        let availableTechId: string | undefined;

        for (const tech of techsWithData) {
          // Check if tech is working this day
          const schedule = tech.schedules[0];
          if (!schedule || !schedule.isWorking) continue;

          // Parse schedule times
          const scheduleStart = parse(schedule.startTime, "HH:mm", date);
          const scheduleEnd = parse(schedule.endTime, "HH:mm", date);

          // Check if slot is within working hours
          if (isBefore(slotStart, scheduleStart) || isAfter(slotEnd, scheduleEnd)) continue;

          // Check for blocking time blocks
          let blocked = false;
          for (const block of tech.blocks) {
            if (block.recurrenceRule) {
              // Check recurring blocks (simplified - just check time)
              if (block.recurringStart && block.recurringEnd) {
                const blockStart = parse(block.recurringStart, "HH:mm", date);
                const blockEnd = parse(block.recurringEnd, "HH:mm", date);
                if (
                  (isAfter(slotStart, blockStart) || slotStart.getTime() === blockStart.getTime()) &&
                  isBefore(slotStart, blockEnd)
                ) {
                  blocked = true;
                  break;
                }
              }
            } else if (block.startTime && block.endTime) {
              // One-time block
              const blockStartTime = new Date(block.startTime);
              const blockEndTime = new Date(block.endTime);
              if (
                (isAfter(slotStart, blockStartTime) || slotStart.getTime() === blockStartTime.getTime()) &&
                isBefore(slotStart, blockEndTime)
              ) {
                blocked = true;
                break;
              }
            }
          }

          if (blocked) continue;

          // Check for conflicting appointments
          const hasConflict = existingAppointments?.some((apt) => {
            if (apt.technicianId !== tech.id) return false;

            const aptStart = new Date(apt.startTime);
            const aptEnd = new Date(apt.endTime);

            // Check if slot overlaps with appointment
            return (
              (slotStart >= aptStart && slotStart < aptEnd) ||
              (slotEnd > aptStart && slotEnd <= aptEnd) ||
              (slotStart <= aptStart && slotEnd >= aptEnd)
            );
          });

          if (!hasConflict) {
            available = true;
            availableTechId = tech.id;
            break; // Found an available tech
          }
        }

        slots.push({
          time: format(slotStart, "h:mm a"),
          available,
          technicianId: availableTechId,
        });
      }
    }

    return NextResponse.json({
      date: dateStr,
      serviceDuration,
      slots,
    });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
