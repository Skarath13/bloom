import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * GET /api/clients/search
 * Search clients by name or phone
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

    // Build OR conditions for search using Supabase
    // Supabase uses ilike for case-insensitive search
    let orConditions = `firstName.ilike.%${query}%,lastName.ilike.%${query}%`;

    // Add phone search if query looks like a number
    if (phoneQuery.length >= 3) {
      orConditions += `,phone.ilike.%${phoneQuery}%`;
    }

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
      .or(orConditions)
      .order("lastName", { ascending: true })
      .limit(20);

    if (error) throw error;

    // Transform to match expected shape
    const transformedClients = clients?.map((client) => ({
      ...client,
      paymentMethods: client.bloom_payment_methods || [],
    }));

    return NextResponse.json({ clients: transformedClients });
  } catch (error) {
    console.error("Search clients error:", error);
    return NextResponse.json(
      { error: "Failed to search clients" },
      { status: 500 }
    );
  }
}
