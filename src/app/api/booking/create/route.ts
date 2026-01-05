import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/stripe";
import { createAppointmentWithCheck, AppointmentConflictError } from "@/lib/appointments";

interface ServiceData {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isBlocked: boolean;
  stripeCustomerId: string | null;
}

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
    const { data: service, error: serviceError } = await supabase
      .from(tables.services)
      .select("*")
      .eq("id", serviceId)
      .single() as { data: ServiceData | null; error: unknown };

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Normalize phone number
    const normalizedPhone = clientPhone.replace(/\D/g, "");

    // ATOMIC CLIENT CREATION: Use upsert with ON CONFLICT
    // This prevents race conditions where two concurrent requests create duplicate clients
    const clientId = generateId();
    const now = new Date().toISOString();

    // Try to insert new client, or return existing one on phone conflict
    const { data: upsertResult, error: upsertError } = await supabase
      .from(tables.clients)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .upsert(
        {
          id: clientId,
          firstName: clientFirstName,
          lastName: clientLastName,
          phone: normalizedPhone,
          email: clientEmail || null,
          phoneVerified: false,
          isBlocked: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          onConflict: "phone",
          ignoreDuplicates: false, // Return existing record on conflict
        }
      )
      .select("*")
      .single() as { data: ClientData | null; error: unknown };

    // If upsert failed, try to fetch existing client
    let client: ClientData | null = upsertResult;
    if (upsertError) {
      const { data: existingClient, error: fetchError } = await supabase
        .from(tables.clients)
        .select("*")
        .eq("phone", normalizedPhone)
        .single() as { data: ClientData | null; error: unknown };

      if (fetchError || !existingClient) {
        console.error("Client creation/fetch error:", upsertError);
        return NextResponse.json(
          { error: "Failed to create client" },
          { status: 500 }
        );
      }
      client = existingClient;
    }

    // At this point client must exist
    if (!client) {
      return NextResponse.json(
        { error: "Failed to create client" },
        { status: 500 }
      );
    }

    // Check if client is blocked
    if (client.isBlocked) {
      return NextResponse.json(
        { error: "Unable to complete booking. Please contact the salon." },
        { status: 403 }
      );
    }

    // Get or create Stripe customer (this has its own idempotency via Stripe)
    const stripeCustomer = await getOrCreateStripeCustomer({
      clientId: client.id,
      email: clientEmail || client.email || undefined,
      name: `${clientFirstName} ${clientLastName}`,
      phone: normalizedPhone,
      existingStripeCustomerId: client.stripeCustomerId || undefined,
    });

    // Update client with Stripe customer ID if new (atomic with WHERE check)
    if (!client.stripeCustomerId) {
      const { data: updatedClient } = await supabase
        .from(tables.clients)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          stripeCustomerId: stripeCustomer.id,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", client.id)
        .is("stripeCustomerId", null) // Only update if still null (prevent race)
        .select("*")
        .single() as { data: ClientData | null; error: unknown };

      if (updatedClient) {
        client = updatedClient;
      }
    }

    // Calculate end time based on service duration
    const appointmentStart = new Date(startTime);
    const appointmentEnd = endTime
      ? new Date(endTime)
      : new Date(appointmentStart.getTime() + service.durationMinutes * 60000);

    // Create appointment with conflict checking
    const appointment = await createAppointmentWithCheck({
      clientId: client.id,
      technicianId,
      locationId,
      serviceId,
      startTime: appointmentStart,
      endTime: appointmentEnd,
      status: "PENDING",
      notes: notes || null,
      noShowProtected: true, // Card on file for protection
      bookedBy: "Client",
      depositAmount: service.depositAmount,
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

    // Handle appointment conflict
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json(
        {
          error: "This time slot is no longer available. Please choose another time.",
          conflict: error.conflict,
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
