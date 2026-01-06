import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/stripe";

/**
 * POST /api/clients/[id]/setup-intent
 * Create a Setup Intent to save a card for a client (without charging)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    // Get client
    const { data: client, error } = await supabase
      .from(tables.clients)
      .select("*")
      .eq("id", clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer({
      clientId: client.id,
      email: client.email || undefined,
      name: `${client.firstName} ${client.lastName}`,
      phone: client.phone,
      existingStripeCustomerId: client.stripeCustomerId,
    });

    // Update client with Stripe customer ID if new
    if (!client.stripeCustomerId) {
      await supabase
        .from(tables.clients)
        .update({
          stripeCustomerId: stripeCustomer.id,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", clientId);
    }

    // Create Setup Intent
    const setupIntent = await createSetupIntent({
      customerId: stripeCustomer.id,
      clientId: client.id,
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: stripeCustomer.id,
    });
  } catch (error) {
    console.error("Create setup intent error:", error);
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
