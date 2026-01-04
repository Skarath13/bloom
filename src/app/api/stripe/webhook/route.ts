import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import prisma from "@/lib/prisma";

// Lazy-load Stripe to avoid build-time errors
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId = session.metadata?.appointmentId;

        if (appointmentId) {
          // Update appointment to CONFIRMED
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
              status: "CONFIRMED",
              depositPaidAt: new Date(),
              stripePaymentIntentId: session.payment_intent as string,
            },
          });

          // Update client's last visit date
          const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            select: { clientId: true },
          });

          if (appointment) {
            await prisma.client.update({
              where: { id: appointment.clientId },
              data: { lastVisitAt: new Date() },
            });
          }

          console.log(`Appointment ${appointmentId} confirmed`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;

        if (appointmentId) {
          // Keep appointment as PENDING - client can retry
          console.log(`Payment failed for appointment ${appointmentId}`);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // Find and update the appointment
        const appointment = await prisma.appointment.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
        });

        if (appointment) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancellationReason: "Refund processed",
            },
          });
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
          console.log(`Setup Intent succeeded for client ${clientId}, payment method: ${paymentMethodId}`);
          // Note: Payment method saving is handled by the API after confirmation
          // This webhook is useful for logging and backup processing
        }
        break;
      }

      case "setup_intent.setup_failed": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const clientId = setupIntent.metadata?.clientId;
        console.log(`Setup Intent failed for client ${clientId}:`, setupIntent.last_setup_error?.message);
        break;
      }

      // ==================== PAYMENT INTENT EVENTS (No-show charges) ====================

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;
        const chargeType = paymentIntent.metadata?.type;

        if (chargeType === "no_show_fee" && appointmentId) {
          // No-show fee was successfully charged
          // Database should already be updated by the API call, but this is a backup
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
              noShowFeeCharged: true,
              noShowChargedAt: new Date(),
              stripePaymentIntentId: paymentIntent.id,
            },
          });
          console.log(`No-show fee charged for appointment ${appointmentId}: $${paymentIntent.amount / 100}`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointmentId;
        const chargeType = paymentIntent.metadata?.type;

        if (chargeType === "no_show_fee") {
          console.log(`No-show fee payment failed for appointment ${appointmentId}:`, paymentIntent.last_payment_error?.message);
          // Note: The appointment will still show as not charged, admin can retry
        } else if (appointmentId) {
          // Keep appointment as PENDING - client can retry
          console.log(`Payment failed for appointment ${appointmentId}`);
        }
        break;
      }

      // ==================== PAYMENT METHOD EVENTS ====================

      case "payment_method.attached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log(`Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`);
        break;
      }

      case "payment_method.detached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        // Remove from database if exists
        try {
          await prisma.paymentMethod.delete({
            where: { stripePaymentMethodId: paymentMethod.id },
          });
          console.log(`Payment method ${paymentMethod.id} removed from database`);
        } catch {
          // Payment method may not exist in our database
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
