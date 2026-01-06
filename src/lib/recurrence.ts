import {
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isAfter,
  startOfDay,
  format,
  parse,
  differenceInMinutes,
} from "date-fns";
import type { RecurrenceException } from "./supabase";

export interface ParsedRecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  count?: number;
  until?: Date;
}

export interface ExpandedInstance {
  id: string; // Original block ID
  instanceDate: string; // ISO date string for this instance (YYYY-MM-DD)
  startTime: Date;
  endTime: Date;
  isRecurring: true;
  isException?: boolean; // True if this is a modified instance
}

/**
 * Parse an RFC 5545 recurrence rule string
 * Example: "FREQ=WEEKLY;INTERVAL=2;COUNT=10"
 */
export function parseRecurrenceRule(rule: string): ParsedRecurrenceRule | null {
  if (!rule) return null;

  const parts = rule.split(";");
  const parsed: Partial<ParsedRecurrenceRule> = {
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split("=");
    switch (key) {
      case "FREQ":
        if (value === "DAILY" || value === "DAY") {
          parsed.freq = "DAILY";
        } else if (value === "WEEKLY" || value === "WEEK") {
          parsed.freq = "WEEKLY";
        } else if (value === "MONTHLY" || value === "MONTH") {
          parsed.freq = "MONTHLY";
        }
        break;
      case "INTERVAL":
        parsed.interval = parseInt(value, 10) || 1;
        break;
      case "COUNT":
        parsed.count = parseInt(value, 10);
        break;
      case "UNTIL":
        // UNTIL format is YYYYMMDD or YYYYMMDDTHHMMSSZ
        if (value.length >= 8) {
          const year = value.substring(0, 4);
          const month = value.substring(4, 6);
          const day = value.substring(6, 8);
          parsed.until = new Date(`${year}-${month}-${day}`);
        }
        break;
    }
  }

  if (!parsed.freq) return null;
  return parsed as ParsedRecurrenceRule;
}

/**
 * Add interval to a date based on frequency
 */
function addInterval(
  date: Date,
  freq: "DAILY" | "WEEKLY" | "MONTHLY",
  interval: number
): Date {
  switch (freq) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addWeeks(date, interval);
    case "MONTHLY":
      return addMonths(date, interval);
  }
}

/**
 * Expand a recurring block into individual instances within a date range
 */
export function expandRecurrence(
  blockId: string,
  startTime: Date,
  endTime: Date,
  recurrenceRule: string,
  exceptions: RecurrenceException[],
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences: number = 365 // Safety limit
): ExpandedInstance[] {
  const parsed = parseRecurrenceRule(recurrenceRule);
  if (!parsed) return [];

  const instances: ExpandedInstance[] = [];
  const duration = differenceInMinutes(endTime, startTime);

  // Create a set of exception dates for quick lookup
  const exceptionDates = new Set(
    exceptions
      .filter((e) => e.type === "deleted")
      .map((e) => e.date)
  );

  let currentStart = new Date(startTime);
  let occurrenceCount = 0;

  // Expand until we hit the end of the range or exceed limits
  while (occurrenceCount < maxOccurrences) {
    const currentDate = format(currentStart, "yyyy-MM-dd");
    const currentEnd = new Date(currentStart.getTime() + duration * 60 * 1000);

    // Check if we've exceeded the UNTIL date
    if (parsed.until && isAfter(startOfDay(currentStart), parsed.until)) {
      break;
    }

    // Check if we've hit the COUNT limit
    if (parsed.count && occurrenceCount >= parsed.count) {
      break;
    }

    // Check if this occurrence is within our query range
    if (
      !isBefore(currentEnd, rangeStart) &&
      !isAfter(currentStart, rangeEnd)
    ) {
      // Check if this date is not an exception (deleted)
      if (!exceptionDates.has(currentDate)) {
        instances.push({
          id: blockId,
          instanceDate: currentDate,
          startTime: currentStart,
          endTime: currentEnd,
          isRecurring: true,
        });
      }
    }

    // If we're past the range end, we can stop
    if (isAfter(currentStart, rangeEnd)) {
      break;
    }

    // Move to next occurrence
    currentStart = addInterval(currentStart, parsed.freq, parsed.interval);
    occurrenceCount++;
  }

  return instances;
}

/**
 * Format a recurrence rule for human-readable display
 * Example: "Every 2 weeks" or "Daily until Jan 30, 2026"
 */
export function formatRecurrenceRule(rule: string): string {
  const parsed = parseRecurrenceRule(rule);
  if (!parsed) return "";

  let result = "";

  // Frequency and interval
  if (parsed.interval === 1) {
    switch (parsed.freq) {
      case "DAILY":
        result = "Daily";
        break;
      case "WEEKLY":
        result = "Weekly";
        break;
      case "MONTHLY":
        result = "Monthly";
        break;
    }
  } else {
    switch (parsed.freq) {
      case "DAILY":
        result = `Every ${parsed.interval} days`;
        break;
      case "WEEKLY":
        result = `Every ${parsed.interval} weeks`;
        break;
      case "MONTHLY":
        result = `Every ${parsed.interval} months`;
        break;
    }
  }

  // End condition
  if (parsed.count) {
    result += `, ${parsed.count} times`;
  } else if (parsed.until) {
    result += ` until ${format(parsed.until, "MMM d, yyyy")}`;
  }

  return result;
}

/**
 * Check if a specific date is an occurrence of a recurring event
 */
export function isOccurrenceOnDate(
  startTime: Date,
  recurrenceRule: string,
  exceptions: RecurrenceException[],
  targetDate: Date
): boolean {
  const dayStart = startOfDay(targetDate);
  const dayEnd = addDays(dayStart, 1);

  const instances = expandRecurrence(
    "check",
    startTime,
    addDays(startTime, 1), // Dummy end time
    recurrenceRule,
    exceptions,
    dayStart,
    dayEnd,
    1000
  );

  return instances.length > 0;
}
