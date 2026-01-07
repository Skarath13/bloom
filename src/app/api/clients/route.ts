import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

/**
 * GET /api/clients
 * List all clients with optional search, filter, and pagination
 * Query params:
 * - page: Page number (default 1)
 * - pageSize: Number of items per page (default 10)
 * - search: Search query (searches name, phone, email)
 * - filter: Filter by status (all, active, blocked, unverified)
 * - limit: Legacy param, same as pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";

    // Build the query
    let query = supabase
      .from(tables.clients)
      .select(`
        *,
        bloom_payment_methods (
          id,
          brand,
          last4,
          isDefault
        )
      `, { count: "exact" });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const phoneDigits = search.replace(/\D/g, "");

      // Use OR filter for name, phone, and email search
      query = query.or(
        `firstName.ilike.%${searchLower}%,lastName.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${phoneDigits}%`
      );
    }

    // Apply status filter
    if (filter === "active") {
      query = query.eq("isBlocked", false).eq("phoneVerified", true);
    } else if (filter === "blocked") {
      query = query.eq("isBlocked", true);
    } else if (filter === "unverified") {
      query = query.eq("phoneVerified", false);
    }

    // Apply ordering and pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order("createdAt", { ascending: false })
      .range(from, to);

    const { data: clients, error, count } = await query;

    if (error) throw error;

    // Get appointment stats for each client
    const clientIds = clients?.map((c) => c.id) || [];
    let appointmentStats: Record<string, { total: number; noShows: number; cancellations: number }> = {};

    if (clientIds.length > 0) {
      const { data: appointments } = await supabase
        .from(tables.appointments)
        .select("clientId, status")
        .in("clientId", clientIds);

      // Calculate stats per client
      appointmentStats = clientIds.reduce((acc, id) => {
        const clientAppts = appointments?.filter((a) => a.clientId === id) || [];
        acc[id] = {
          total: clientAppts.length,
          noShows: clientAppts.filter((a) => a.status === "NO_SHOW").length,
          cancellations: clientAppts.filter((a) => a.status === "CANCELLED").length,
        };
        return acc;
      }, {} as Record<string, { total: number; noShows: number; cancellations: number }>);
    }

    // Transform to match expected shape
    const transformedClients = clients?.map((client) => ({
      ...client,
      paymentMethods: client.bloom_payment_methods || [],
      totalAppointments: appointmentStats[client.id]?.total || 0,
      noShows: appointmentStats[client.id]?.noShows || 0,
      cancellations: appointmentStats[client.id]?.cancellations || 0,
    }));

    return NextResponse.json({
      clients: transformedClients,
      total: count || 0,
      page,
      pageSize,
    });
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
