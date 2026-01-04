import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = {
      reminder24h: { sent: 0, failed: 0 },
      reminder2h: { sent: 0, failed: 0 },
    };

    // 24-hour reminders: Find appointments between 23-25 hours from now
    const reminder24hStart = addHours(now, 23);
    const reminder24hEnd = addHours(now, 25);

    const appointments24h = await prisma.appointment.findMany({
      where: {
        startTime: {
          gte: reminder24hStart,
          lte: reminder24hEnd,
        },
        status: "CONFIRMED",
        reminder24hSent: false,
      },
      include: {
        client: true,
        service: true,
        technician: true,
        location: true,
      },
    });

    for (const apt of appointments24h) {
      const result = await send24HourReminder({
        phone: apt.client.phone,
        clientName: apt.client.firstName,
        serviceName: apt.service.name,
        technicianName: `${apt.technician.firstName} ${apt.technician.lastName.charAt(0)}.`,
        locationName: apt.location.name,
        dateTime: apt.startTime,
      });

      if (result.success) {
        await prisma.appointment.update({
          where: { id: apt.id },
          data: { reminder24hSent: true },
        });
        results.reminder24h.sent++;
      } else {
        console.error(`Failed 24h reminder for appointment ${apt.id}:`, result.error);
        results.reminder24h.failed++;
      }
    }

    // 2-hour reminders: Find appointments between 1.75-2.25 hours from now
    const reminder2hStart = addMinutes(now, 105); // 1h 45m
    const reminder2hEnd = addMinutes(now, 135); // 2h 15m

    const appointments2h = await prisma.appointment.findMany({
      where: {
        startTime: {
          gte: reminder2hStart,
          lte: reminder2hEnd,
        },
        status: "CONFIRMED",
        reminder2hSent: false,
      },
      include: {
        client: true,
        service: true,
        location: true,
      },
    });

    for (const apt of appointments2h) {
      const result = await send2HourReminder({
        phone: apt.client.phone,
        clientName: apt.client.firstName,
        serviceName: apt.service.name,
        locationName: apt.location.name,
        locationAddress: `${apt.location.address}, ${apt.location.city}`,
        dateTime: apt.startTime,
      });

      if (result.success) {
        await prisma.appointment.update({
          where: { id: apt.id },
          data: { reminder2hSent: true },
        });
        results.reminder2h.sent++;
      } else {
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
