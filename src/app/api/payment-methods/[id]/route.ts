import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import Stripe from "stripe";

interface PaymentMethodWithClient {
  id: string;
  stripePaymentMethodId: string;
  clientId: string;
  isDefault: boolean;
  bloom_clients: {
    stripeCustomerId: string | null;
  } | null;
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * DELETE /api/payment-methods/[id]
 * Remove a payment method from a client
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodId } = await params;

    // Get the payment method from database
    const { data: paymentMethod, error: fetchError } = await supabase
      .from(tables.paymentMethods)
      .select("*, bloom_clients (stripeCustomerId)")
      .eq("id", paymentMethodId)
      .single() as { data: PaymentMethodWithClient | null; error: unknown };

    if (fetchError || !paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    // Detach from Stripe first
    try {
      const stripe = getStripeClient();
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
    } catch (stripeError) {
      console.error("Failed to detach from Stripe:", stripeError);
      // Continue with database deletion even if Stripe fails
      // (payment method may already be detached)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from(tables.paymentMethods)
      .delete()
      .eq("id", paymentMethodId);

    if (deleteError) {
      console.error("Failed to delete payment method:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete payment method" },
        { status: 500 }
      );
    }

    // If this was the default card, make another card the default
    const { data: otherCards } = await supabase
      .from(tables.paymentMethods)
      .select("id")
      .eq("clientId", paymentMethod.clientId)
      .limit(1) as { data: { id: string }[] | null; error: unknown };

    if (otherCards && otherCards.length > 0 && paymentMethod.isDefault) {
      await supabase
        .from(tables.paymentMethods)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .update({ isDefault: true, updatedAt: new Date().toISOString() })
        .eq("id", otherCards[0].id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete payment method error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment method" },
      { status: 500 }
    );
  }
}
