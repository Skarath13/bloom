import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { send24HourReminder, send2HourReminder } from "@/lib/twilio";
import { addHours, addMinutes } from "date-fns";

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
  bloom_clients: {
    phone: string;
    firstName: string;
  };
  bloom_services: {
    name: string;
  };
  bloom_technicians: {
    firstName: string;
    lastName: string;
  };
  bloom_locations: {
    name: string;
    address: string;
    city: string;
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = {
      reminder24h: { sent: 0, failed: 0, skipped: 0 },
      reminder2h: { sent: 0, failed: 0, skipped: 0 },
    };

    // 24-hour reminders: Find appointments between 23-25 hours from now
    const reminder24hStart = addHours(now, 23);
    const reminder24hEnd = addHours(now, 25);

    const { data: appointments24h } = await supabase
      .from(tables.appointments)
      .select(`
        id,
        startTime,
        bloom_clients (phone, firstName),
        bloom_services (name),
        bloom_technicians (firstName, lastName),
        bloom_locations (name, address, city)
      `)
      .gte("startTime", reminder24hStart.toISOString())
      .lte("startTime", reminder24hEnd.toISOString())
      .eq("status", "CONFIRMED")
      .eq("reminder24hSent", false);

    for (const apt of (appointments24h || []) as unknown as AppointmentWithRelations[]) {
      // ATOMIC: Mark as sent BEFORE sending to prevent double-send race condition
      // Only proceed if we successfully claim this reminder
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder24hSent: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder24hSent", false) // Only update if still false
        .select("id")
        .single();

      if (claimError || !claimed) {
        // Another process already claimed this reminder
        results.reminder24h.skipped++;
        continue;
      }

      // Now safe to send - we own this reminder
      const result = await send24HourReminder({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        serviceName: apt.bloom_services.name,
        technicianName: `${apt.bloom_technicians.firstName} ${apt.bloom_technicians.lastName.charAt(0)}.`,
        locationName: apt.bloom_locations.name,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder24h.sent++;
      } else {
        // SMS failed - rollback the flag so it can be retried
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder24hSent: false,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(`Failed 24h reminder for appointment ${apt.id}:`, result.error);
        results.reminder24h.failed++;
      }
    }

    // 2-hour reminders: Find appointments between 1.75-2.25 hours from now
    const reminder2hStart = addMinutes(now, 105); // 1h 45m
    const reminder2hEnd = addMinutes(now, 135); // 2h 15m

    const { data: appointments2h } = await supabase
      .from(tables.appointments)
      .select(`
        id,
        startTime,
        bloom_clients (phone, firstName),
        bloom_services (name),
        bloom_locations (name, address, city)
      `)
      .gte("startTime", reminder2hStart.toISOString())
      .lte("startTime", reminder2hEnd.toISOString())
      .eq("status", "CONFIRMED")
      .eq("reminder2hSent", false);

    for (const apt of (appointments2h || []) as unknown as AppointmentWithRelations[]) {
      // ATOMIC: Mark as sent BEFORE sending to prevent double-send race condition
      const { data: claimed, error: claimError } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          reminder2hSent: true,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", apt.id)
        .eq("reminder2hSent", false) // Only update if still false
        .select("id")
        .single();

      if (claimError || !claimed) {
        // Another process already claimed this reminder
        results.reminder2h.skipped++;
        continue;
      }

      // Now safe to send - we own this reminder
      const result = await send2HourReminder({
        phone: apt.bloom_clients.phone,
        clientName: apt.bloom_clients.firstName,
        serviceName: apt.bloom_services.name,
        locationName: apt.bloom_locations.name,
        locationAddress: `${apt.bloom_locations.address}, ${apt.bloom_locations.city}`,
        dateTime: new Date(apt.startTime),
      });

      if (result.success) {
        results.reminder2h.sent++;
      } else {
        // SMS failed - rollback the flag so it can be retried
        await supabase
          .from(tables.appointments)
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .update({
            reminder2hSent: false,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", apt.id);
        console.error(`Failed 2h reminder for appointment ${apt.id}:`, result.error);
        results.reminder2h.failed++;
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
