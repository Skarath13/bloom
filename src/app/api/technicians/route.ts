import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    let query = supabase
      .from("bloom_technicians")
      .select(`
        id,
        firstName,
        lastName,
        email,
        phone,
        color,
        avatarUrl,
        defaultBufferMinutes,
        isActive,
        sortOrder,
        locationId,
        createdAt,
        updatedAt,
        location:bloom_locations(id, name, city),
        schedules:bloom_technician_schedules(id, dayOfWeek, startTime, endTime, isWorking)
      `)
      .order("firstName", { ascending: true });

    if (locationId) {
      query = query.eq("locationId", locationId);
    }

    if (activeOnly) {
      query = query.eq("isActive", true);
    }

    const { data: technicians, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return NextResponse.json({ technicians: technicians || [] });
  } catch (error) {
    console.error("Fetch technicians error:", error);
    return NextResponse.json(
      { error: "Failed to fetch technicians" },
      { status: 500 }
    );
  }
}
