import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { chargeNoShowFee } from "@/lib/stripe";

/**
 * POST /api/appointments/[id]/charge
 * Charge a no-show or late cancellation fee for an appointment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const { amount, reason } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Get appointment with client and service info
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: {
          include: {
            paymentMethods: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
        service: true,
        technician: true,
        location: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check if already charged
    if (appointment.noShowFeeCharged) {
      return NextResponse.json(
        { error: "No-show fee already charged for this appointment" },
        { status: 400 }
      );
    }

    // Check if client has Stripe customer and payment method
    if (!appointment.client.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client has no payment method on file" },
        { status: 400 }
      );
    }

    const defaultPaymentMethod = appointment.client.paymentMethods[0];
    if (!defaultPaymentMethod) {
      return NextResponse.json(
        { error: "Client has no payment method on file" },
        { status: 400 }
      );
    }

    // Build description
    const chargeReason = reason || "No-show fee";
    const description = `${chargeReason} - ${appointment.service.name} with ${appointment.technician.firstName} at ${appointment.location.name}`;

    // Charge the card
    const paymentIntent = await chargeNoShowFee({
      customerId: appointment.client.stripeCustomerId,
      paymentMethodId: defaultPaymentMethod.stripePaymentMethodId,
      amount,
      appointmentId,
      description,
    });

    // Update appointment record
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        noShowFeeCharged: true,
        noShowFeeAmount: amount,
        noShowChargedAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      amount,
      message: `Successfully charged $${amount.toFixed(2)} for ${chargeReason.toLowerCase()}`,
    });
  } catch (error) {
    console.error("Charge no-show fee error:", error);

    // Handle Stripe-specific errors
    if (error instanceof Error && error.message.includes("card")) {
      return NextResponse.json(
        { error: `Card declined: ${error.message}` },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "Failed to charge no-show fee" },
      { status: 500 }
    );
  }
}
