import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const technicianId = searchParams.get("technicianId");
    const date = searchParams.get("date"); // YYYY-MM-DD format
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    // Build the where clause
    const where: Record<string, unknown> = {};

    if (locationId) {
      where.locationId = locationId;
    }

    if (technicianId) {
      where.technicianId = technicianId;
    }

    if (status) {
      where.status = status;
    }

    // Handle date filtering
    // Dates are stored in UTC, query using ISO date strings with PST offset
    if (date) {
      // Create start and end of day in PST (UTC-8)
      const dayStart = new Date(`${date}T00:00:00-08:00`);
      const dayEnd = new Date(`${date}T23:59:59.999-08:00`);
      where.startTime = {
        gte: dayStart,
        lte: dayEnd,
      };
    } else if (startDate && endDate) {
      const rangeStart = new Date(`${startDate}T00:00:00-08:00`);
      const rangeEnd = new Date(`${endDate}T23:59:59.999-08:00`);
      where.startTime = {
        gte: rangeStart,
        lte: rangeEnd,
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            phoneVerified: true,
            isBlocked: true,
            stripeCustomerId: true,
            paymentMethods: {
              select: {
                id: true,
                brand: true,
                last4: true,
                isDefault: true,
              },
              orderBy: { isDefault: "desc" },
            },
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            durationMinutes: true,
            price: true,
          },
        },
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("Fetch appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments
 * Create a new appointment (admin manual booking)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      technicianId,
      locationId,
      serviceId,
      startTime,
      endTime,
      status = "CONFIRMED",
      notes,
      noShowProtected = false,
    } = body;

    // Validate required fields
    if (!clientId || !technicianId || !locationId || !serviceId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get service to calculate deposit amount
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        technicianId,
        locationId,
        serviceId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status,
        notes: notes || null,
        noShowProtected,
        depositAmount: service.depositAmount,
        confirmedAt: status === "CONFIRMED" ? new Date() : null,
      },
      include: {
        client: true,
        service: true,
        technician: true,
        location: true,
      },
    });

    return NextResponse.json({
      success: true,
      appointment,
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
