import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      locationId,
      serviceId,
      technicianId,
      startTime,
      endTime,
      clientFirstName,
      clientLastName,
      clientPhone,
      clientEmail,
      notes,
    } = body;

    // Validate required fields
    if (!locationId || !serviceId || !technicianId || !startTime || !clientFirstName || !clientLastName || !clientPhone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get service details
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Find or create client
    const normalizedPhone = clientPhone.replace(/\D/g, "");
    let client = await prisma.client.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          firstName: clientFirstName,
          lastName: clientLastName,
          phone: normalizedPhone,
          email: clientEmail || null,
          phoneVerified: false,
        },
      });
    }

    // Check if client is blocked
    if (client.isBlocked) {
      return NextResponse.json(
        { error: "Unable to complete booking. Please contact the salon." },
        { status: 403 }
      );
    }

    // Get or create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer({
      clientId: client.id,
      email: clientEmail || client.email || undefined,
      name: `${clientFirstName} ${clientLastName}`,
      phone: normalizedPhone,
      existingStripeCustomerId: client.stripeCustomerId,
    });

    // Update client with Stripe customer ID if new
    if (!client.stripeCustomerId) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: { stripeCustomerId: stripeCustomer.id },
      });
    }

    // Calculate end time based on service duration
    const appointmentStart = new Date(startTime);
    const appointmentEnd = endTime
      ? new Date(endTime)
      : new Date(appointmentStart.getTime() + service.durationMinutes * 60000);

    // Create appointment with PENDING status and no-show protection enabled
    const appointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        technicianId,
        locationId,
        serviceId,
        startTime: appointmentStart,
        endTime: appointmentEnd,
        depositAmount: service.depositAmount, // Still track for reference
        status: "PENDING",
        notes: notes || null,
        noShowProtected: true, // Card on file for protection
      },
      include: {
        service: true,
        location: true,
        technician: true,
      },
    });

    // Create Setup Intent for card-on-file
    const setupIntent = await createSetupIntent({
      customerId: stripeCustomer.id,
      clientId: client.id,
    });

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      clientId: client.id,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      appointment: {
        id: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        service: appointment.service,
        location: appointment.location,
        technician: appointment.technician,
      },
    });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
