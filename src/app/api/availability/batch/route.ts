import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, type RecurrenceException } from "@/lib/supabase";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore, isAfter, parseISO } from "date-fns";
import { expandRecurrence } from "@/lib/recurrence";

interface TimeSlot {
  time: string;
  available: boolean;
  technicianId?: string;
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
  dayOfWeek: number;
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

interface DateAvailability {
  date: string;
  hasAvailability: boolean;
  slotCount: number;
}

function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function overlapsAny(slotStart: Date, slotEnd: Date, intervals: BusyInterval[]): boolean {
  for (const interval of intervals) {
    if (slotStart.getTime() < interval.end.getTime() && slotEnd.getTime() > interval.start.getTime()) {
      return true;
    }
  }
  return false;
}

function expandBlocksForDate(blocks: BlockRow[], date: Date): BusyInterval[] {
  const intervals: BusyInterval[] = [];
  for (const block of blocks) {
    if (block.recurrenceRule && block.startTime && block.endTime) {
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
        intervals.push({ start: instance.startTime, end: instance.endTime });
      }
    } else if (block.startTime && block.endTime) {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
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

function hasAvailableSlotsForTech(
  tech: TechWithData,
  date: Date,
  dayOfWeek: number,
  appointments: AppointmentRow[],
  now: Date
): boolean {
  const schedule = tech.schedules.find(s => s.dayOfWeek === dayOfWeek);
  if (!schedule || !schedule.isWorking) return false;

  const scheduleStart = parse(schedule.startTime, "HH:mm", date);
  const scheduleEnd = parse(schedule.endTime, "HH:mm", date);
  const buffer = tech.defaultBufferMinutes;
  const duration = tech.serviceDuration;

  const techAppointments = appointments.filter((a) => a.technicianId === tech.id);
  const blockIntervals = expandBlocksForDate(tech.blocks, date);

  // Build busy intervals
  const busyIntervals: BusyInterval[] = [];
  for (const apt of techAppointments) {
    busyIntervals.push({ start: new Date(apt.startTime), end: new Date(apt.endTime) });
  }
  for (const block of blockIntervals) {
    busyIntervals.push(block);
  }
  const mergedBusy = mergeIntervals(busyIntervals);

  // Check hourly slots for availability (quick check)
  const scheduleStartHour = scheduleStart.getHours();
  const scheduleEndHour = scheduleEnd.getHours();

  for (let hour = scheduleStartHour; hour <= scheduleEndHour; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = addMinutes(slotStart, duration);

    if (isBefore(slotStart, now)) continue;
    if (isBefore(slotStart, scheduleStart)) continue;
    if (isAfter(slotEnd, scheduleEnd)) continue;
    if (overlapsAny(slotStart, slotEnd, mergedBusy)) continue;

    return true; // Found at least one available slot
  }

  // Also check appointment end + buffer times
  for (const apt of techAppointments) {
    const aptEnd = new Date(apt.endTime);
    const slotStart = addMinutes(aptEnd, buffer);
    const slotEnd = addMinutes(slotStart, duration);

    if (isBefore(slotStart, now)) continue;
    if (isBefore(slotStart, scheduleStart)) continue;
    if (isAfter(slotEnd, scheduleEnd)) continue;
    if (overlapsAny(slotStart, slotEnd, mergedBusy)) continue;

    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, serviceId, technicianId, dates } = body as {
      locationId: string;
      serviceId: string;
      technicianId: string;
      dates: string[];
    };

    if (!locationId || !serviceId || !dates || dates.length === 0) {
      return NextResponse.json(
        { error: "Missing required parameters: locationId, serviceId, dates" },
        { status: 400 }
      );
    }

    const now = new Date();
    const parsedDates = dates.map(d => parse(d, "yyyy-MM-dd", new Date()));
    const minDate = startOfDay(parsedDates[0]);
    const maxDate = endOfDay(parsedDates[parsedDates.length - 1]);

    // Get all days of week we need schedules for
    const daysOfWeek = [...new Set(parsedDates.map(d => d.getDay()))];

    // OPTIMIZATION: Run all queries in parallel
    const [serviceResult, techResult] = await Promise.all([
      supabase
        .from(tables.services)
        .select("*")
        .eq("id", serviceId)
        .single(),
      (() => {
        let query = supabase
          .from(tables.technicians)
          .select("*")
          .eq("locationId", locationId)
          .eq("isActive", true);
        if (technicianId && technicianId !== "any") {
          query = query.eq("id", technicianId);
        }
        return query;
      })(),
    ]);

    const { data: service, error: serviceError } = serviceResult;
    const { data: technicians, error: techError } = techResult;

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    if (techError) throw techError;

    const defaultServiceDuration = (service as { durationMinutes: number }).durationMinutes;
    const techIds = (technicians as TechnicianRow[] | null)?.map((t) => t.id) || [];

    if (techIds.length === 0) {
      return NextResponse.json({
        availability: dates.map(date => ({ date, hasAvailability: false, slotCount: 0 })),
      });
    }

    // Get all data needed for all dates in parallel
    const [serviceTechResult, schedulesResult, blocksResult, appointmentsResult] = await Promise.all([
      supabase
        .from(tables.serviceTechnicians)
        .select("technicianId, customDurationMinutes")
        .eq("serviceId", serviceId)
        .in("technicianId", techIds),
      supabase
        .from(tables.technicianSchedules)
        .select("*")
        .in("technicianId", techIds)
        .in("dayOfWeek", daysOfWeek),
      supabase
        .from(tables.technicianBlocks)
        .select("*")
        .in("technicianId", techIds)
        .eq("isActive", true),
      supabase
        .from(tables.appointments)
        .select("technicianId, startTime, endTime")
        .eq("locationId", locationId)
        .gte("startTime", minDate.toISOString())
        .lte("startTime", maxDate.toISOString())
        .not("status", "in", '("CANCELLED","NO_SHOW")'),
    ]);

    const { data: serviceTechSettings } = serviceTechResult;
    const { data: schedules } = schedulesResult;
    const { data: blocks } = blocksResult;
    const { data: existingAppointments } = appointmentsResult;

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

    const allAppointments = (existingAppointments as AppointmentRow[] | null) || [];

    // Build technician data
    const techsWithData: TechWithData[] = ((technicians as TechnicianRow[] | null) || []).map((tech) => ({
      id: tech.id,
      defaultBufferMinutes: (tech.defaultBufferMinutes as number) || 0,
      serviceDuration: techDurationMap.get(tech.id) || defaultServiceDuration,
      appointmentCount: 0,
      schedules: ((schedules as ScheduleRow[] | null) || []).filter((s) => s.technicianId === tech.id),
      blocks: ((blocks as BlockRow[] | null) || []).filter((b) => b.technicianId === tech.id),
    }));

    // Check availability for each date
    const availability: DateAvailability[] = [];

    for (const dateStr of dates) {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      const dayOfWeek = date.getDay();
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filter appointments for this specific date
      const dayAppointments = allAppointments.filter(apt => {
        const aptStart = new Date(apt.startTime);
        return aptStart >= dayStart && aptStart <= dayEnd;
      });

      let hasAvailability = false;

      for (const tech of techsWithData) {
        if (hasAvailableSlotsForTech(tech, date, dayOfWeek, dayAppointments, now)) {
          hasAvailability = true;
          break;
        }
      }

      availability.push({
        date: dateStr,
        hasAvailability,
        slotCount: hasAvailability ? 1 : 0, // Just indicate if there's availability
      });
    }

    return NextResponse.json({ availability });
  } catch (error) {
    console.error("Batch availability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
