import { isAfter } from "date-fns";

/**
 * Appointment Status Utilities
 *
 * These utilities help determine the display status of appointments,
 * particularly for computing "COMPLETED" status which is now implicit
 * (appointments are considered completed if they ended and weren't cancelled/no-show).
 */

/**
 * Get the display status for an appointment.
 * Returns "COMPLETED" for past appointments that weren't cancelled or no-show.
 */
export function getDisplayStatus(appointment: {
  status: string;
  startTime: Date | string;
  endTime: Date | string;
}): string {
  const now = new Date();
  const endTime = new Date(appointment.endTime);

  // If appointment has ended and wasn't cancelled/no-show, it's "completed"
  if (
    isAfter(now, endTime) &&
    !["CANCELLED", "NO_SHOW"].includes(appointment.status)
  ) {
    return "COMPLETED";
  }

  return appointment.status;
}

/**
 * Check if an appointment is considered completed.
 */
export function isAppointmentCompleted(appointment: {
  status: string;
  endTime: Date | string;
}): boolean {
  return getDisplayStatus({ ...appointment, startTime: appointment.endTime }) === "COMPLETED";
}

/**
 * Check if an appointment is active (not cancelled, no-show, or completed).
 */
export function isAppointmentActive(appointment: {
  status: string;
  endTime: Date | string;
}): boolean {
  const displayStatus = getDisplayStatus({ ...appointment, startTime: appointment.endTime });
  return !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(displayStatus);
}

/**
 * Get statuses that should be excluded from scheduling conflicts.
 * Cancelled and no-show appointments don't create conflicts.
 */
export function getNonConflictingStatuses(): string[] {
  return ["CANCELLED", "NO_SHOW"];
}

/**
 * Get statuses that indicate an appointment is "live" and should receive reminders.
 * Excludes cancelled and no-show appointments.
 */
export function getLiveStatuses(): string[] {
  return ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];
}
