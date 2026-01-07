import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import { getPaymentMethodDetails, setDefaultPaymentMethod } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/twilio";
import { differenceInHours } from "date-fns";

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

    // Get the appointment with client
    const { data: appointment, error: apptError } = await supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_clients (*)
      `)
      .eq("id", appointmentId)
      .single();

    if (apptError || !appointment) {
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

    const client = appointment.bloom_clients;

    // Get payment method details from Stripe
    const pmDetails = await getPaymentMethodDetails(paymentMethodId);

    // Check if payment method already exists
    const { data: existingPm } = await supabase
      .from(tables.paymentMethods)
      .select("*")
      .eq("stripePaymentMethodId", paymentMethodId)
      .single();

    if (!existingPm) {
      // Check if client has any other payment methods
      const { count: existingMethods } = await supabase
        .from(tables.paymentMethods)
        .select("*", { count: "exact", head: true })
        .eq("clientId", clientId);

      const isFirstCard = (existingMethods || 0) === 0;

      // If this is the first card, make it default
      if (isFirstCard && client?.stripeCustomerId) {
        await setDefaultPaymentMethod(
          client.stripeCustomerId,
          paymentMethodId
        );
      }

      // Save the payment method to database
      await supabase
        .from(tables.paymentMethods)
        .insert({
          id: generateId(),
          clientId,
          stripePaymentMethodId: paymentMethodId,
          brand: pmDetails.brand,
          last4: pmDetails.last4,
          expiryMonth: pmDetails.expiryMonth,
          expiryYear: pmDetails.expiryYear,
          isDefault: isFirstCard,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
    }

    // Check if appointment is within 6 hours - auto-confirm if so (no time for reminder flow)
    const hoursUntilAppointment = differenceInHours(
      new Date(appointment.startTime),
      new Date()
    );
    const isWithin6Hours = hoursUntilAppointment < 6;

    // Update appointment status to CONFIRMED
    // If within 6 hours, also set smsConfirmedAt/By to skip reminder flow
    const { error: updateError } = await supabase
      .from(tables.appointments)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({
        status: "CONFIRMED",
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Auto-confirm if within 6 hours (skip SMS confirmation flow)
        ...(isWithin6Hours && {
          smsConfirmedAt: new Date().toISOString(),
          smsConfirmedBy: "auto",
        }),
      })
      .eq("id", appointmentId);

    if (updateError) throw updateError;

    // Send booking confirmation SMS
    if (client?.phone) {
      try {
        await sendBookingConfirmation({
          phone: client.phone,
          clientName: client.firstName || "there",
          dateTime: new Date(appointment.startTime),
        });
      } catch (smsError) {
        console.error("Failed to send booking confirmation SMS:", smsError);
        // Don't fail the booking if SMS fails
      }
    }

    // Get the updated appointment with relations
    const { data: updatedAppointment } = await supabase
      .from(tables.appointments)
      .select(`
        *,
        bloom_services (*),
        bloom_locations (*),
        bloom_technicians (*),
        bloom_clients (*)
      `)
      .eq("id", appointmentId)
      .single();

    // Update client's updatedAt (for tracking)
    await supabase
      .from(tables.clients)
      .update({ updatedAt: new Date().toISOString() })
      .eq("id", clientId);

    return NextResponse.json({
      success: true,
      appointment: {
        id: updatedAppointment?.id,
        status: updatedAppointment?.status,
        startTime: updatedAppointment?.startTime,
        endTime: updatedAppointment?.endTime,
        service: updatedAppointment?.bloom_services,
        location: updatedAppointment?.bloom_locations,
        technician: updatedAppointment?.bloom_technicians,
        client: {
          firstName: updatedAppointment?.bloom_clients?.firstName,
          lastName: updatedAppointment?.bloom_clients?.lastName,
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
