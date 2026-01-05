import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface ClientWithPayments {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  stripeCustomerId: string | null;
  bloom_payment_methods: PaymentMethod[];
}

/**
 * GET /api/clients/[id]
 * Get a single client by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: client, error } = await supabase
      .from(tables.clients)
      .select(`
        *,
        bloom_payment_methods (*)
      `)
      .eq("id", id)
      .single() as { data: ClientWithPayments | null; error: unknown };

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      client: {
        ...client,
        paymentMethods: client.bloom_payment_methods || [],
      },
    });
  } catch (error) {
    console.error("Get client error:", error);
    return NextResponse.json(
      { error: "Failed to get client" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 * Update a client's information
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update data - only include fields that are provided
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.isBlocked !== undefined) updateData.isBlocked = body.isBlocked;
    if (body.blockReason !== undefined) updateData.blockReason = body.blockReason;

    const { data: client, error } = await supabase
      .from(tables.clients)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        bloom_payment_methods (*)
      `)
      .single() as { data: ClientWithPayments | null; error: unknown };

    if (error) {
      console.error("Update client error:", error);
      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 }
      );
    }

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      client: {
        ...client,
        paymentMethods: client.bloom_payment_methods || [],
      },
    });
  } catch (error) {
    console.error("Update client error:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}
