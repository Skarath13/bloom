import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") !== "false";

    let query = supabase
      .from(tables.locations)
      .select("*")
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("isActive", true);
    }

    const { data: locations, error } = await query;

    if (error) throw error;

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Fetch locations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}
