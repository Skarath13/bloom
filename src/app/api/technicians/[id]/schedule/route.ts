import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: schedules, error } = await supabase
      .from(tables.technicianSchedules)
      .select("id, dayOfWeek, startTime, endTime, isWorking")
      .eq("technicianId", id)
      .order("dayOfWeek", { ascending: true });

    if (error) {
      console.error("Error fetching schedule:", error);
      throw error;
    }

    return NextResponse.json({ schedules: schedules || [] });
  } catch (error) {
    console.error("Fetch schedule error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { schedules } = body as { schedules: ScheduleEntry[] };

    if (!schedules || !Array.isArray(schedules)) {
      return NextResponse.json(
        { error: "Schedules array is required" },
        { status: 400 }
      );
    }

    // Delete existing schedules
    const { error: deleteError } = await supabase
      .from("bloom_technician_schedules")
      .delete()
      .eq("technicianId", id);

    if (deleteError) {
      console.error("Error deleting schedules:", deleteError);
      throw deleteError;
    }

    // Insert new schedules
    if (schedules.length > 0) {
      const scheduleData = schedules.map((s) => ({
        technicianId: id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isWorking: s.isWorking,
      }));

      const { error: insertError } = await supabase
        .from("bloom_technician_schedules")
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .insert(scheduleData);

      if (insertError) {
        console.error("Error inserting schedules:", insertError);
        throw insertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}
