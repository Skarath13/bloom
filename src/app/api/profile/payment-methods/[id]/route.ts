import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { verifySessionToken } from "@/lib/session";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27.acacia",
});

// DELETE /api/profile/payment-methods/[id] - Remove a saved payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodId } = await params;

    // Get session token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Authorization required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Verify session token
    const session = verifySessionToken(token);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session", code: "INVALID_SESSION" },
        { status: 401 }
      );
    }

    // Verify the payment method belongs to this client
    const { data: paymentMethod, error: fetchError } = await supabase
      .from(tables.paymentMethods)
      .select("id, clientId, stripePaymentMethodId")
      .eq("id", paymentMethodId)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (paymentMethod.clientId !== session.clientId) {
      return NextResponse.json(
        { error: "Not authorized to delete this payment method", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Detach from Stripe first (if Stripe is configured)
    if (process.env.STRIPE_SECRET_KEY && paymentMethod.stripePaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      } catch (stripeError) {
        console.error("Stripe detach error:", stripeError);
        // Continue with database deletion even if Stripe fails
        // The card may have already been detached or expired
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from(tables.paymentMethods)
      .delete()
      .eq("id", paymentMethodId);

    if (deleteError) {
      console.error("Payment method delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete payment method", code: "DELETE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment method removed successfully",
    });
  } catch (error) {
    console.error("Payment method DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment method", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
