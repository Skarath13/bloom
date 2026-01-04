import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const serviceDuration = service.durationMinutes;

    // Get technicians for the location (or specific technician)
    const technicians = await prisma.technician.findMany({
      where: {
        locationId,
        isActive: true,
        ...(technicianId && technicianId !== "any" ? { id: technicianId } : {}),
      },
      include: {
        schedules: {
          where: { dayOfWeek },
        },
        blocks: {
          where: { isActive: true },
        },
      },
    });

    // Get existing appointments for the date
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        locationId,
        startTime: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: {
          notIn: ["CANCELLED", "NO_SHOW"],
        },
        ...(technicianId && technicianId !== "any" ? { technicianId } : {}),
      },
    });

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

        for (const tech of technicians) {
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
              if (
                (isAfter(slotStart, block.startTime) || slotStart.getTime() === block.startTime.getTime()) &&
                isBefore(slotStart, block.endTime)
              ) {
                blocked = true;
                break;
              }
            }
          }

          if (blocked) continue;

          // Check for conflicting appointments
          const hasConflict = existingAppointments.some((apt) => {
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
