import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

/**
 * GET /api/clients
 * List all clients with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    const { data: clients, error } = await supabase
      .from(tables.clients)
      .select(`
        *,
        bloom_payment_methods (
          id,
          brand,
          last4,
          isDefault
        )
      `)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Transform to match expected shape
    const transformedClients = clients?.map((client) => ({
      ...client,
      paymentMethods: client.bloom_payment_methods || [],
    }));

    return NextResponse.json({ clients: transformedClients });
  } catch (error) {
    console.error("List clients error:", error);
    return NextResponse.json(
      { error: "Failed to list clients" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, phone, email } = body;

    // Validate required fields
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: "First name, last name, and phone are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    // Check if client with this phone already exists
    const { data: existingClient } = await supabase
      .from(tables.clients)
      .select(`
        *,
        bloom_payment_methods (
          id,
          brand,
          last4,
          isDefault
        )
      `)
      .eq("phone", normalizedPhone)
      .single();

    if (existingClient) {
      return NextResponse.json({
        client: {
          ...existingClient,
          paymentMethods: existingClient.bloom_payment_methods || [],
        },
        message: "Client already exists with this phone number",
        existing: true,
      });
    }

    // Create new client
    const { data: client, error } = await supabase
      .from(tables.clients)
      .insert({
        id: generateId(),
        firstName,
        lastName,
        phone: normalizedPhone,
        email: email || null,
        phoneVerified: false,
        isBlocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select(`
        *,
        bloom_payment_methods (
          id,
          brand,
          last4,
          isDefault
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      client: {
        ...client,
        paymentMethods: client?.bloom_payment_methods || [],
      },
      message: "Client created successfully",
      existing: false,
    });
  } catch (error) {
    console.error("Create client error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
