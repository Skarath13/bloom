import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPaymentMethodDetails, setDefaultPaymentMethod } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, clientId, paymentMethodId } = body;

    // Validate required fields
    if (!appointmentId || !clientId || !paymentMethodId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    if (appointment.clientId !== clientId) {
      return NextResponse.json(
        { error: "Appointment does not belong to this client" },
        { status: 403 }
      );
    }

    // Get payment method details from Stripe
    const pmDetails = await getPaymentMethodDetails(paymentMethodId);

    // Check if payment method already exists
    const existingPm = await prisma.paymentMethod.findUnique({
      where: { stripePaymentMethodId: paymentMethodId },
    });

    if (!existingPm) {
      // Check if client has any other payment methods
      const existingMethods = await prisma.paymentMethod.count({
        where: { clientId },
      });

      const isFirstCard = existingMethods === 0;

      // If this is the first card, make it default
      if (isFirstCard && appointment.client.stripeCustomerId) {
        await setDefaultPaymentMethod(
          appointment.client.stripeCustomerId,
          paymentMethodId
        );
      }

      // Save the payment method to database
      await prisma.paymentMethod.create({
        data: {
          clientId,
          stripePaymentMethodId: paymentMethodId,
          brand: pmDetails.brand,
          last4: pmDetails.last4,
          expiryMonth: pmDetails.expiryMonth,
          expiryYear: pmDetails.expiryYear,
          isDefault: isFirstCard,
        },
      });
    }

    // Update appointment status to CONFIRMED
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      include: {
        service: true,
        location: true,
        technician: true,
        client: true,
      },
    });

    // Update client's lastVisitAt (for tracking)
    await prisma.client.update({
      where: { id: clientId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      appointment: {
        id: updatedAppointment.id,
        status: updatedAppointment.status,
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
        service: updatedAppointment.service,
        location: updatedAppointment.location,
        technician: updatedAppointment.technician,
        client: {
          firstName: updatedAppointment.client.firstName,
          lastName: updatedAppointment.client.lastName,
        },
      },
    });
  } catch (error) {
    console.error("Confirm booking error:", error);
    return NextResponse.json(
      { error: "Failed to confirm booking" },
      { status: 500 }
    );
  }
}
