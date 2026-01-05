import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { supabase, tables } from "@/lib/supabase";

// Lazy-load Stripe to avoid build-time errors
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Check if a webhook event has already been processed (idempotency)
 * Returns true if event was already processed, false if new
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from("bloom_stripe_webhook_events")
    .select("id")
    .eq("id", eventId)
    .single();

  return !!data;
}

/**
 * Mark a webhook event as processed
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  payload?: object
): Promise<void> {
  // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
  await supabase.from("bloom_stripe_webhook_events").insert({
    id: eventId,
    event_type: eventType,
    payload: payload || null,
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // IDEMPOTENCY CHECK: Skip if already processed
  if (await isEventProcessed(event.id)) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId = session.metadata?.appointmentId;

        if (appointmentId) {
          // Update appointment to CONFIRMED (idempotent - same result if run twice)
          await supabase
            .from(tables.appointments)
            // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
            .update({
              status: "CONFIRMED",
              depositPaidAt: new Date().toISOString(),
              stripePaymentIntentId: session.payment_intent as string,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", appointmentId);

          // Update client's last visit date
          const { data: appointment } = await supabase
            .from(tables.appointments)
            .select("clientId")
            .eq("id", appointmentId)
            .single() as { data: { clientId: string } | null; error: unknown };

          if (appointment) {
            await supabase
              .from(tables.clients)
              // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
              .update({
                lastVisitAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .eq("id", appointment.clientId);
          }

          console.log(`Appointment ${appointmentId} confirmed`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;
        const chargeType = paymentIntent.metadata?.type;

        if (chargeType === "no_show_fee") {
          console.log(
            `No-show fee payment failed for appointment ${appointmentId}:`,
            paymentIntent.last_payment_error?.message
          );
          // Note: The appointment will still show as not charged, admin can retry
        } else if (appointmentId) {
          // Keep appointment as PENDING - client can retry
          console.log(`Payment failed for appointment ${appointmentId}`);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // Find and update the appointment
        const { data: appointment } = await supabase
          .from(tables.appointments)
          .select("id")
          .eq("stripePaymentIntentId", paymentIntentId)
          .single() as { data: { id: string } | null; error: unknown };

        if (appointment) {
          await supabase
            .from(tables.appointments)
            // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
            .update({
              status: "CANCELLED",
              cancelledAt: new Date().toISOString(),
              cancellationReason: "Refund processed",
              updatedAt: new Date().toISOString(),
            })
            .eq("id", appointment.id);
          console.log(`Appointment ${appointment.id} cancelled due to refund`);
        }
        break;
      }

      // ==================== SETUP INTENT EVENTS (Card-on-file) ====================

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const clientId = setupIntent.metadata?.clientId;
        const paymentMethodId = setupIntent.payment_method as string;

        if (clientId && paymentMethodId) {
          console.log(
            `Setup Intent succeeded for client ${clientId}, payment method: ${paymentMethodId}`
          );
          // Note: Payment method saving is handled by the API after confirmation
          // This webhook is useful for logging and backup processing
        }
        break;
      }

      case "setup_intent.setup_failed": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const clientId = setupIntent.metadata?.clientId;
        console.log(
          `Setup Intent failed for client ${clientId}:`,
          setupIntent.last_setup_error?.message
        );
        break;
      }

      // ==================== PAYMENT INTENT EVENTS (No-show charges) ====================

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;
        const chargeType = paymentIntent.metadata?.type;

        if (chargeType === "no_show_fee" && appointmentId) {
          // No-show fee was successfully charged
          // Use atomic update to prevent issues (idempotent operation)
          await supabase
            .from(tables.appointments)
            // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
            .update({
              noShowFeeCharged: true,
              noShowChargedAt: new Date().toISOString(),
              stripePaymentIntentId: paymentIntent.id,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", appointmentId);
          console.log(
            `No-show fee charged for appointment ${appointmentId}: $${paymentIntent.amount / 100}`
          );
        }
        break;
      }

      // ==================== PAYMENT METHOD EVENTS ====================

      case "payment_method.attached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log(
          `Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`
        );
        break;
      }

      case "payment_method.detached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        // Remove from database if exists (idempotent - ok if already deleted)
        await supabase
          .from(tables.paymentMethods)
          .delete()
          .eq("stripePaymentMethodId", paymentMethod.id);
        console.log(`Payment method ${paymentMethod.id} removed from database`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed for idempotency
    await markEventProcessed(event.id, event.type);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Don't mark as processed on error - allow retry
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
