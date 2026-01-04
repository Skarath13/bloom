/**
 * EXAMPLE: This file shows the Supabase JS client version of the search route.
 * Once Supabase keys are configured, rename this to route.ts to replace Prisma version.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * GET /api/clients/search
 * Search clients by name or phone (Supabase version)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ clients: [] });
    }

    // Normalize the query - remove non-alphanumeric for phone matching
    const phoneQuery = query.replace(/\D/g, "");

    // Build the query
    let dbQuery = supabase
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
      .order("lastName", { ascending: true })
      .limit(20);

    // Search by name using ilike for case-insensitive matching
    if (phoneQuery.length >= 3) {
      // If it looks like a phone number, search phone too
      dbQuery = dbQuery.or(`firstName.ilike.%${query}%,lastName.ilike.%${query}%,phone.ilike.%${phoneQuery}%`);
    } else {
      dbQuery = dbQuery.or(`firstName.ilike.%${query}%,lastName.ilike.%${query}%`);
    }

    const { data: clients, error } = await dbQuery;

    if (error) {
      console.error("Search clients error:", error);
      return NextResponse.json(
        { error: "Failed to search clients" },
        { status: 500 }
      );
    }

    // Transform payment methods to match expected format
    const transformedClients = clients?.map(client => ({
      ...client,
      paymentMethods: client.bloom_payment_methods || [],
    }));

    return NextResponse.json({ clients: transformedClients || [] });
  } catch (error) {
    console.error("Search clients error:", error);
    return NextResponse.json(
      { error: "Failed to search clients" },
      { status: 500 }
    );
  }
}
