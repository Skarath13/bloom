import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, type RecurrenceException } from "@/lib/supabase";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore, isAfter, parseISO } from "date-fns";
import { expandRecurrence } from "@/lib/recurrence";

interface TimeSlot {
  time: string;
  available: boolean;
  technicianId?: string;
}

interface Anchor {
  time: Date;
  type: "day_start" | "appointment_end" | "block_end";
}

interface BusyInterval {
  start: Date;
  end: Date;
}

interface TechnicianRow {
  id: string;
  defaultBufferMinutes?: number | null;
  [key: string]: unknown;
}

interface ScheduleRow {
  technicianId: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
}

interface BlockRow {
  id: string;
  technicianId: string;
  recurrenceRule: string | null;
  startTime: string | null;
  endTime: string | null;
  recurrenceExceptions?: Array<{ date: string; type: string }>;
  [key: string]: unknown;
}

interface AppointmentRow {
  technicianId: string;
  startTime: string;
  endTime: string;
}

interface TechWithData {
  id: string;
  defaultBufferMinutes: number;
  serviceDuration: number;
  appointmentCount: number;
  schedules: ScheduleRow[];
  blocks: BlockRow[];
}

/**
 * Merge overlapping intervals into non-overlapping sorted list
 */
function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start.getTime() <= last.end.getTime()) {
      // Overlapping or adjacent - extend
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Check if a proposed slot overlaps any busy interval
 */
function overlapsAny(slotStart: Date, slotEnd: Date, intervals: BusyInterval[]): boolean {
  for (const interval of intervals) {
    // Overlap: slotStart < interval.end AND slotEnd > interval.start
    if (slotStart.getTime() < interval.end.getTime() && slotEnd.getTime() > interval.start.getTime()) {
      return true;
    }
  }
  return false;
}

/**
 * Expand all blocks for a technician on a specific date
 */
function expandBlocksForDate(blocks: BlockRow[], date: Date): BusyInterval[] {
  const intervals: BusyInterval[] = [];

  for (const block of blocks) {
    if (block.recurrenceRule && block.startTime && block.endTime) {
      // Recurring block - expand for this date
      const instances = expandRecurrence(
        block.id,
        parseISO(block.startTime),
        parseISO(block.endTime),
        block.recurrenceRule,
        (block.recurrenceExceptions as RecurrenceException[]) || [],
        startOfDay(date),
        endOfDay(date)
      );

      for (const instance of instances) {
        intervals.push({
          start: instance.startTime,
          end: instance.endTime,
        });
      }
    } else if (block.startTime && block.endTime) {
      // One-time block - check if it falls on this date
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Check if block overlaps with this day
      if (blockStart <= dayEnd && blockEnd >= dayStart) {
        intervals.push({
          start: blockStart < dayStart ? dayStart : blockStart,
          end: blockEnd > dayEnd ? dayEnd : blockEnd,
        });
      }
    }
  }

  return intervals;
}

/**
 * Generate anchor-based slots for a single technician
 */
function generateAnchoredSlotsForTech(
  tech: TechWithData,
  date: Date,
  appointments: AppointmentRow[],
  now: Date
): TimeSlot[] {
  const schedule = tech.schedules[0];
  if (!schedule || !schedule.isWorking) return [];

  const scheduleStart = parse(schedule.startTime, "HH:mm", date);
  const scheduleEnd = parse(schedule.endTime, "HH:mm", date);
  const buffer = tech.defaultBufferMinutes;
  const duration = tech.serviceDuration;

  // Get appointments for this tech
  const techAppointments = appointments.filter((a) => a.technicianId === tech.id);

  // Expand blocks for this date
  const blockIntervals = expandBlocksForDate(tech.blocks, date);

  // Build anchors
  const anchors: Anchor[] = [];

  // Anchor 1: Day start
  anchors.push({ time: scheduleStart, type: "day_start" });

  // Anchor 2: Hourly fallback slots (for flexibility when day is empty)
  // Add every hour from schedule start to end
  const scheduleStartHour = scheduleStart.getHours();
  const scheduleEndHour = scheduleEnd.getHours();
  for (let hour = scheduleStartHour; hour <= scheduleEndHour; hour++) {
    const hourlyTime = new Date(date);
    hourlyTime.setHours(hour, 0, 0, 0);
    // Only add if within schedule bounds and service fits
    if (hourlyTime >= scheduleStart && addMinutes(hourlyTime, duration) <= scheduleEnd) {
      anchors.push({ time: hourlyTime, type: "day_start" }); // Treat as day_start priority
    }
  }

  // Anchor 3: Appointment ends + buffer (these take priority as optimal slots)
  for (const apt of techAppointments) {
    const aptEnd = new Date(apt.endTime);
    const endWithBuffer = addMinutes(aptEnd, buffer);
    anchors.push({ time: endWithBuffer, type: "appointment_end" });
  }

  // Anchor 4: Block ends
  for (const block of blockIntervals) {
    anchors.push({ time: block.end, type: "block_end" });
  }

  // Sort anchors by time
  anchors.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Deduplicate anchors at same time (prefer day_start > appointment_end > block_end)
  const uniqueAnchors: Anchor[] = [];
  const seenTimes = new Set<number>();
  for (const anchor of anchors) {
    const timeKey = anchor.time.getTime();
    if (!seenTimes.has(timeKey)) {
      seenTimes.add(timeKey);
      uniqueAnchors.push(anchor);
    }
  }

  // Build busy intervals (appointments + blocks)
  const busyIntervals: BusyInterval[] = [];

  for (const apt of techAppointments) {
    busyIntervals.push({
      start: new Date(apt.startTime),
      end: new Date(apt.endTime),
    });
  }

  for (const block of blockIntervals) {
    busyIntervals.push(block);
  }

  const mergedBusy = mergeIntervals(busyIntervals);

  // Generate valid slots from anchors
  const slots: TimeSlot[] = [];

  for (const anchor of uniqueAnchors) {
    const slotStart = anchor.time;
    const slotEnd = addMinutes(slotStart, duration);

    // Skip past slots
    if (isBefore(slotStart, now)) continue;

    // Skip if starts before working hours
    if (isBefore(slotStart, scheduleStart)) continue;

    // Skip if ends after working hours
    if (isAfter(slotEnd, scheduleEnd)) continue;

    // Skip if overlaps any busy interval
    if (overlapsAny(slotStart, slotEnd, mergedBusy)) continue;

    slots.push({
      time: format(slotStart, "h:mm a"),
      available: true,
      technicianId: tech.id,
    });
  }

  return slots;
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
    const now = new Date();

    // Get service duration
    const { data: service, error: serviceError } = await supabase
      .from(tables.services)
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const defaultServiceDuration = (service as { durationMinutes: number }).durationMinutes;

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

    const techIds = (technicians as TechnicianRow[] | null)?.map((t) => t.id) || [];

    if (techIds.length === 0) {
      return NextResponse.json({
        date: dateStr,
        serviceDuration: defaultServiceDuration,
        slots: [],
      });
    }

    // Get per-tech service duration overrides
    const { data: serviceTechSettings } = await supabase
      .from(tables.serviceTechnicians)
      .select("technicianId, customDurationMinutes")
      .eq("serviceId", serviceId)
      .in("technicianId", techIds);

    interface ServiceTechSetting {
      technicianId: string;
      customDurationMinutes: number | null;
    }

    const techDurationMap = new Map<string, number>();
    for (const setting of (serviceTechSettings as ServiceTechSetting[] | null) || []) {
      if (setting.customDurationMinutes) {
        techDurationMap.set(setting.technicianId, setting.customDurationMinutes);
      }
    }

    // Get schedules for these technicians
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

    // Get existing appointments for the date (for all techs at this location)
    const { data: existingAppointments } = await supabase
      .from(tables.appointments)
      .select("*")
      .eq("locationId", locationId)
      .gte("startTime", startOfDay(date).toISOString())
      .lte("startTime", endOfDay(date).toISOString())
      .not("status", "in", '("CANCELLED","NO_SHOW")');

    const appointments = (existingAppointments as AppointmentRow[] | null) || [];

    // Count appointments per technician (for fairness sorting)
    const techAppointmentCounts = new Map<string, number>();
    for (const apt of appointments) {
      const count = techAppointmentCounts.get(apt.technicianId) || 0;
      techAppointmentCounts.set(apt.technicianId, count + 1);
    }

    // Build technicians with all their data
    const techsWithData: TechWithData[] = ((technicians as TechnicianRow[] | null) || []).map((tech) => ({
      id: tech.id,
      defaultBufferMinutes: (tech.defaultBufferMinutes as number) || 0,
      serviceDuration: techDurationMap.get(tech.id) || defaultServiceDuration,
      appointmentCount: techAppointmentCounts.get(tech.id) || 0,
      schedules: ((schedules as ScheduleRow[] | null) || []).filter((s) => s.technicianId === tech.id),
      blocks: ((blocks as BlockRow[] | null) || []).filter((b) => b.technicianId === tech.id),
    }));

    let allSlots: TimeSlot[] = [];

    if (technicianId && technicianId !== "any") {
      // Single technician mode
      const tech = techsWithData[0];
      if (tech) {
        allSlots = generateAnchoredSlotsForTech(tech, date, appointments, now);
      }
    } else {
      // "Any technician" mode - aggregate from all techs with fairness
      const slotMap = new Map<string, { techId: string; appointmentCount: number }[]>();

      for (const tech of techsWithData) {
        const techSlots = generateAnchoredSlotsForTech(tech, date, appointments, now);

        for (const slot of techSlots) {
          const key = slot.time;
          if (!slotMap.has(key)) {
            slotMap.set(key, []);
          }
          slotMap.get(key)!.push({
            techId: tech.id,
            appointmentCount: tech.appointmentCount,
          });
        }
      }

      // Convert map to array, picking best technician for each time slot
      // Fairness: prefer techs with FEWER appointments to balance workload
      for (const [time, techOptions] of slotMap) {
        // Sort by appointment count (ascending) - techs with fewer appointments first
        techOptions.sort((a, b) => a.appointmentCount - b.appointmentCount);

        allSlots.push({
          time,
          available: true,
          technicianId: techOptions[0].techId,
        });
      }

      // Sort slots by time
      allSlots.sort((a, b) => {
        const timeA = parse(a.time, "h:mm a", date);
        const timeB = parse(b.time, "h:mm a", date);
        return timeA.getTime() - timeB.getTime();
      });
    }

    return NextResponse.json({
      date: dateStr,
      serviceDuration: defaultServiceDuration,
      slots: allSlots,
    });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
