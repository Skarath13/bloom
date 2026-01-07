import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import {
  validateTwilioSignature,
  parseConfirmationIntent,
  sendConfirmationAcknowledgment,
  formatPhoneE164,
} from "@/lib/twilio";
import { addDays } from "date-fns";

/**
 * Twilio Incoming SMS Webhook Handler
 *
 * Handles incoming SMS messages from clients for appointment confirmation.
 * Configure in Twilio Console: Phone Numbers > Your Number > Messaging Webhook
 */

/**
 * Check if webhook message was already processed (idempotency)
 */
async function isMessageProcessed(messageSid: string): Promise<boolean> {
  const { data } = await supabase
    .from("bloom_twilio_webhook_events")
    .select("id")
    .eq("id", messageSid)
    .single();
  return !!data;
}

/**
 * Mark webhook message as processed
 */
async function markMessageProcessed(
  messageSid: string,
  fromNumber: string,
  body: string
): Promise<void> {
  await supabase.from("bloom_twilio_webhook_events").insert({
    id: messageSid,
    event_type: "incoming_sms",
    from_number: fromNumber,
    body,
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

/**
 * Normalize phone number to 10-digit format for matching
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Return last 10 digits (removes country code if present)
  return digits.slice(-10);
}

/**
 * Find the most relevant appointment for this phone number
 * Priority: PENDING appointments within next 7 days, closest to now
 */
async function findAppointmentForPhone(phone: string): Promise<{
  appointment: {
    id: string;
    startTime: string;
    status: string;
    bloom_services: { name: string } | null;
  };
  client: { id: string; firstName: string; phone: string };
  alreadyConfirmed: boolean;
} | null> {
  const now = new Date();
  const weekFromNow = addDays(now, 7);

  // Normalize phone for matching
  const normalized = normalizePhone(phone);

  // Find client by phone (check both with and without leading 1)
  const { data: clients } = await supabase
    .from(tables.clients)
    .select("id, firstName, phone")
    .or(`phone.ilike.%${normalized}`);

  if (!clients || clients.length === 0) {
    console.log(`No client found for phone: ${phone} (normalized: ${normalized})`);
    return null;
  }

  // Use the first matching client
  const client = clients[0];

  // Find upcoming PENDING appointments for this client
  const { data: pendingAppointments } = await supabase
    .from(tables.appointments)
    .select(
      `
      id,
      startTime,
      status,
      bloom_services (name)
    `
    )
    .eq("clientId", client.id)
    .eq("status", "PENDING")
    .gte("startTime", now.toISOString())
    .lte("startTime", weekFromNow.toISOString())
    .order("startTime", { ascending: true })
    .limit(1);

  if (pendingAppointments && pendingAppointments.length > 0) {
    return {
      // @ts-expect-error - Supabase types don't resolve nested relations correctly
      appointment: pendingAppointments[0],
      client,
      alreadyConfirmed: false,
    };
  }

  // No PENDING appointments, check if they have a CONFIRMED one
  // (in case they're confirming again)
  const { data: confirmedAppointments } = await supabase
    .from(tables.appointments)
    .select(
      `
      id,
      startTime,
      status,
      bloom_services (name)
    `
    )
    .eq("clientId", client.id)
    .eq("status", "CONFIRMED")
    .gte("startTime", now.toISOString())
    .lte("startTime", weekFromNow.toISOString())
    .order("startTime", { ascending: true })
    .limit(1);

  if (confirmedAppointments && confirmedAppointments.length > 0) {
    return {
      // @ts-expect-error - Supabase types don't resolve nested relations correctly
      appointment: confirmedAppointments[0],
      client,
      alreadyConfirmed: true,
    };
  }

  console.log(`No upcoming appointments found for client ${client.id}`);
  return null;
}

export async function POST(request: NextRequest) {
  // Twilio sends form-urlencoded data
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  const { MessageSid, From, Body, To } = params;

  console.log(`Received SMS from ${From}: "${Body}" (MessageSid: ${MessageSid})`);

  // Validate signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = request.headers.get("x-twilio-signature") || "";
    const webhookUrl =
      process.env.TWILIO_WEBHOOK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`;

    if (!validateTwilioSignature(signature, webhookUrl, params)) {
      console.error("Invalid Twilio signature - rejecting request");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Idempotency check - prevent processing same message twice
  if (await isMessageProcessed(MessageSid)) {
    console.log(`Message ${MessageSid} already processed, skipping`);
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  try {
    const intent = parseConfirmationIntent(Body);

    if (intent === "confirm") {
      const result = await findAppointmentForPhone(From);

      if (!result) {
        console.log(`No appointment found for phone ${From} to confirm`);
        // Mark as processed but don't send error message (avoid spam)
        await markMessageProcessed(MessageSid, From, Body);
        return new Response("<Response></Response>", {
          headers: { "Content-Type": "text/xml" },
        });
      }

      if (result.alreadyConfirmed) {
        console.log(
          `Appointment ${result.appointment.id} already confirmed, sending acknowledgment`
        );
        // Still send a friendly acknowledgment
        await sendConfirmationAcknowledgment({
          phone: From,
          clientName: result.client.firstName || "there",
          dateTime: new Date(result.appointment.startTime),
        });
        await markMessageProcessed(MessageSid, From, Body);
        return new Response("<Response></Response>", {
          headers: { "Content-Type": "text/xml" },
        });
      }

      // Confirm the appointment
      const { error } = await supabase
        .from(tables.appointments)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({
          status: "CONFIRMED",
          smsConfirmedAt: new Date().toISOString(),
          smsConfirmedBy: "client",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", result.appointment.id)
        .eq("status", "PENDING"); // Only if still PENDING (atomic)

      if (error) {
        console.error(
          `Failed to confirm appointment ${result.appointment.id}:`,
          error
        );
      } else {
        console.log(
          `Appointment ${result.appointment.id} confirmed via SMS from ${From}`
        );

        // Send acknowledgment SMS
        await sendConfirmationAcknowledgment({
          phone: From,
          clientName: result.client.firstName || "there",
          dateTime: new Date(result.appointment.startTime),
        });
      }
    } else {
      // Unknown intent - log for manual review
      console.log(`Unknown SMS intent from ${From}: "${Body}"`);
    }

    // Mark as processed
    await markMessageProcessed(MessageSid, From, Body);

    // Return TwiML empty response (no auto-reply for unknown intents)
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    // Don't mark as processed on error - allow retry
    // Return 200 anyway - Twilio expects 200 even on errors to prevent retries
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
      status: 200,
    });
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
