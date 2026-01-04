import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRefund } from "@/lib/stripe";
import { sendCancellationNotification } from "@/lib/twilio";
import { differenceInHours } from "date-fns";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
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

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("Fetch appointment error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Get current appointment
    const currentAppointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!currentAppointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.technicianId !== undefined) {
      updateData.technicianId = body.technicianId;
    }

    if (body.startTime !== undefined) {
      updateData.startTime = new Date(body.startTime);
    }

    if (body.endTime !== undefined) {
      updateData.endTime = new Date(body.endTime);
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        service: true,
        technician: true,
        location: true,
      },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const forceRefund = searchParams.get("forceRefund") === "true";

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        service: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check cancellation policy (6 hours)
    const hoursUntilAppointment = differenceInHours(
      appointment.startTime,
      new Date()
    );
    const canRefund = hoursUntilAppointment >= 6 || forceRefund;

    // Process refund if eligible and payment was made
    let refundAmount = 0;
    if (canRefund && appointment.stripePaymentIntentId && appointment.depositPaidAt) {
      try {
        await createRefund(appointment.stripePaymentIntentId);
        refundAmount = Number(appointment.depositAmount);
      } catch (refundError) {
        console.error("Refund failed:", refundError);
        // Continue with cancellation even if refund fails
      }
    }

    // Update appointment status
    await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: forceRefund
          ? "Cancelled by admin with refund"
          : canRefund
          ? "Cancelled by client (more than 6 hours notice)"
          : "Cancelled by client (deposit forfeited)",
      },
    });

    // Send cancellation SMS
    await sendCancellationNotification({
      phone: appointment.client.phone,
      clientName: appointment.client.firstName,
      serviceName: appointment.service.name,
      dateTime: appointment.startTime,
      refundAmount: canRefund ? refundAmount : undefined,
    });

    return NextResponse.json({
      success: true,
      refunded: canRefund && refundAmount > 0,
      refundAmount,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json(
      { error: "Failed to cancel appointment" },
      { status: 500 }
    );
  }
}
