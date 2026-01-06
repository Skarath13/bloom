import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import {
  getPaymentMethodDetails,
  detachPaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/stripe";

/**
 * GET /api/clients/[id]/payment-methods
 * List all saved payment methods for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    // Get client
    const { data: client, error: clientError } = await supabase
      .from(tables.clients)
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get payment methods
    const { data: paymentMethods, error: pmError } = await supabase
      .from(tables.paymentMethods)
      .select("*")
      .eq("clientId", clientId)
      .order("createdAt", { ascending: false });

    if (pmError) throw pmError;

    return NextResponse.json({
      paymentMethods: paymentMethods || [],
      hasCardOnFile: (paymentMethods?.length || 0) > 0,
    });
  } catch (error) {
    console.error("List payment methods error:", error);
    return NextResponse.json(
      { error: "Failed to list payment methods" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/payment-methods
 * Save a new payment method after Setup Intent completes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { paymentMethodId, setAsDefault } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 }
      );
    }

    // Get client with payment methods count
    const { data: client, error: clientError } = await supabase
      .from(tables.clients)
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client has no Stripe customer" },
        { status: 400 }
      );
    }

    // Get payment method details from Stripe
    const pmDetails = await getPaymentMethodDetails(paymentMethodId);

    // Check if already saved
    const { data: existingPm } = await supabase
      .from(tables.paymentMethods)
      .select("*")
      .eq("stripePaymentMethodId", paymentMethodId)
      .single();

    if (existingPm) {
      return NextResponse.json({
        paymentMethod: existingPm,
        message: "Payment method already saved",
      });
    }

    // Get count of existing payment methods
    const { count } = await supabase
      .from(tables.paymentMethods)
      .select("*", { count: "exact", head: true })
      .eq("clientId", clientId);

    // If setting as default or first card, update other cards
    const isFirstCard = (count || 0) === 0;
    const shouldBeDefault = setAsDefault || isFirstCard;

    if (shouldBeDefault) {
      // Unset other defaults
      await supabase
        .from(tables.paymentMethods)
        .update({ isDefault: false, updatedAt: new Date().toISOString() })
        .eq("clientId", clientId)
        .eq("isDefault", true);

      // Set as default in Stripe too
      await setDefaultPaymentMethod(client.stripeCustomerId, paymentMethodId);
    }

    // Save to database
    const { data: paymentMethod, error: createError } = await supabase
      .from(tables.paymentMethods)
      .insert({
        id: generateId(),
        clientId,
        stripePaymentMethodId: paymentMethodId,
        brand: pmDetails.brand,
        last4: pmDetails.last4,
        expiryMonth: pmDetails.expiryMonth,
        expiryYear: pmDetails.expiryYear,
        isDefault: shouldBeDefault,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    return NextResponse.json({ paymentMethod });
  } catch (error) {
    console.error("Save payment method error:", error);
    return NextResponse.json(
      { error: "Failed to save payment method" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/payment-methods
 * Remove a saved payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("paymentMethodId");

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 }
      );
    }

    // Get payment method
    const { data: paymentMethod } = await supabase
      .from(tables.paymentMethods)
      .select("*")
      .eq("clientId", clientId)
      .eq("stripePaymentMethodId", paymentMethodId)
      .single();

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    // Detach from Stripe
    await detachPaymentMethod(paymentMethodId);

    // Delete from database
    await supabase
      .from(tables.paymentMethods)
      .delete()
      .eq("id", paymentMethod.id);

    // If this was the default, set another card as default
    if (paymentMethod.isDefault) {
      const { data: otherCard } = await supabase
        .from(tables.paymentMethods)
        .select("*")
        .eq("clientId", clientId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .single();

      if (otherCard) {
        await supabase
          .from(tables.paymentMethods)
          .update({ isDefault: true, updatedAt: new Date().toISOString() })
          .eq("id", otherCard.id);
      }
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
