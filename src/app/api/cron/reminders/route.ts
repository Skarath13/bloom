import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import {
  send48HourConfirmationRequest,
  send24HourReminder,
  send12HourReminder,
  send6HourFinalWarning,
} from "@/lib/twilio";
import { addHours, addMinutes } from "date-fns";

/**
 * Appointment Reminder Cron Job
 *
 * Runs every 15 minutes via Vercel Cron to send appointment reminders.
 *
 * Reminder Flow:
 * - 48h before: First reminder + set status to PENDING (awaiting confirmation)
 * - 24h before: Second reminder (if still PENDING)
 * - 12h before: Third reminder (if still PENDING)
 * - 6h before: Final warning with cancellation threat (if still PENDING)
 *
 * Only sends to appointments that are not CANCELLED or NO_SHOW.
 * Uses atomic claim pattern to prevent duplicate sends in concurrent requests.
 */

// Vercel Cron security - verify the request is from Vercel
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not set - allowing request in development");
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface AppointmentWithRelations {
  id: string;
  startTime: string;
  status: string;
  bloom_clients: {
    phone: string;
    firstName: string;
  };
}

interface ReminderResult {
  sent: number;
  failed: number;
  skipped: number;
  statusChanged?: number;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results: Record<string, ReminderResult> = {
      reminder48h: { sent: 0, failed: 0, skipped: 0, statusChanged: 0 },
      reminder24h: { sent: 0, failed: 0, skipped: 0 },
      reminder12h: { sent: 0, failed: 0, skipped: 0 },
      reminder6h: { sent: 0, failed: 0, skipped: 0 },
    };

    // ================================================================
    // 48-HOUR REMINDERS
    // First confirmation request - sets status to PENDING
    // Window: 47-49 hours from now
    // ================================================================
    const reminder48hStart = addHours(now, 47);
    const reminder48hEnd = addHours(now, 49);

    // Find appointments that haven't had 48h reminder sent yet
    // Exclude CANCELLED and NO_SHOW (they shouldn't get reminders)
    // Also exclude appointments already confirmed (smsConfirmedAt is set - e.g., booked within 6h)
    const { data: appointments48h } = await supabase
      .from(tables.appointments)
      .select(
        `
        id,
        startTime,
        status,
        bloom_clients (phone, firstName)
      `
      )
      .gte("startTime", reminder48hStart.toISOString())
      .lte("startTime", reminder48hEnd.toISOString())
      .not("status", "in", '("CANCELLED","NO_SHOW")')
      .eq("reminder48hSent", false)
      .is("smsConfirmedAt", null);

    for (const apt of (appointments48h ||
      []) as unknown as AppointmentWithRelations[]) {
      // ATOMIC: Mark as sent AND set status to PENDING BEFORE sending
      // This prevents double-send race conditions
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder48hSent: true,
          status: "PENDING", // KEY: Set to PENDING at 48h mark
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder48hSent", false) // Only update if still false
        .select("id")
        .single();

      if (claimError || !claimed) {
        // Another process already claimed this reminder
        results.reminder48h.skipped++;
        continue;
      }

      // Now safe to send - we own this reminder
      const result = await send48HourConfirmationRequest({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder48h.sent++;
        results.reminder48h.statusChanged!++;
      } else {
        // SMS failed - rollback the flag AND status so it can be retried
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder48hSent: false,
            status: apt.status, // Restore original status
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(
          `Failed 48h reminder for appointment ${apt.id}:`,
          result.error
        );
        results.reminder48h.failed++;
      }
    }

    // ================================================================
    // 24-HOUR REMINDERS
    // Second reminder - only for PENDING (unconfirmed) appointments
    // Window: 23-25 hours from now
    // ================================================================
    const reminder24hStart = addHours(now, 23);
    const reminder24hEnd = addHours(now, 25);

    const { data: appointments24h } = await supabase
      .from(tables.appointments)
      .select(
        `
        id,
        startTime,
        bloom_clients (phone, firstName)
      `
      )
      .gte("startTime", reminder24hStart.toISOString())
      .lte("startTime", reminder24hEnd.toISOString())
      .eq("status", "PENDING") // Only unconfirmed
      .eq("reminder24hSent", false);

    for (const apt of (appointments24h ||
      []) as unknown as AppointmentWithRelations[]) {
      // ATOMIC: Mark as sent BEFORE sending
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder24hSent: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder24hSent", false)
        .eq("status", "PENDING") // Double-check still pending
        .select("id")
        .single();

      if (claimError || !claimed) {
        results.reminder24h.skipped++;
        continue;
      }

      const result = await send24HourReminder({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder24h.sent++;
      } else {
        // Rollback
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder24hSent: false,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(
          `Failed 24h reminder for appointment ${apt.id}:`,
          result.error
        );
        results.reminder24h.failed++;
      }
    }

    // ================================================================
    // 12-HOUR REMINDERS
    // Third reminder - only for PENDING (unconfirmed) appointments
    // Window: 11.5-12.5 hours from now
    // ================================================================
    const reminder12hStart = addMinutes(now, 690); // 11.5 hours
    const reminder12hEnd = addMinutes(now, 750); // 12.5 hours

    const { data: appointments12h } = await supabase
      .from(tables.appointments)
      .select(
        `
        id,
        startTime,
        bloom_clients (phone, firstName)
      `
      )
      .gte("startTime", reminder12hStart.toISOString())
      .lte("startTime", reminder12hEnd.toISOString())
      .eq("status", "PENDING")
      .eq("reminder12hSent", false);

    for (const apt of (appointments12h ||
      []) as unknown as AppointmentWithRelations[]) {
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder12hSent: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder12hSent", false)
        .eq("status", "PENDING")
        .select("id")
        .single();

      if (claimError || !claimed) {
        results.reminder12h.skipped++;
        continue;
      }

      const result = await send12HourReminder({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder12h.sent++;
      } else {
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder12hSent: false,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(
          `Failed 12h reminder for appointment ${apt.id}:`,
          result.error
        );
        results.reminder12h.failed++;
      }
    }

    // ================================================================
    // 6-HOUR FINAL WARNING
    // Last chance reminder with cancellation threat
    // Window: 5.5-6.5 hours from now
    // ================================================================
    const reminder6hStart = addMinutes(now, 330); // 5.5 hours
    const reminder6hEnd = addMinutes(now, 390); // 6.5 hours

    const { data: appointments6h } = await supabase
      .from(tables.appointments)
      .select(
        `
        id,
        startTime,
        bloom_clients (phone, firstName)
      `
      )
      .gte("startTime", reminder6hStart.toISOString())
      .lte("startTime", reminder6hEnd.toISOString())
      .eq("status", "PENDING")
      .eq("reminder6hSent", false);

    for (const apt of (appointments6h ||
      []) as unknown as AppointmentWithRelations[]) {
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder6hSent: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder6hSent", false)
        .eq("status", "PENDING")
        .select("id")
        .single();

      if (claimError || !claimed) {
        results.reminder6h.skipped++;
        continue;
      }

      const result = await send6HourFinalWarning({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder6h.sent++;
      } else {
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder6hSent: false,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(
          `Failed 6h warning for appointment ${apt.id}:`,
          result.error
        );
        results.reminder6h.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error("Reminder cron error:", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 }
    );
  }
}
