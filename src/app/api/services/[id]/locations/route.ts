import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * PUT /api/services/[id]/locations
 * Batch update location associations for a service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const body = await request.json();
    const { locationIds } = body;

    if (!Array.isArray(locationIds)) {
      return NextResponse.json(
        { error: "locationIds must be an array" },
        { status: 400 }
      );
    }

    // Delete all existing associations
    const { error: deleteError } = await supabase
      .from(tables.serviceLocations)
      .delete()
      .eq("serviceId", serviceId);

    if (deleteError) {
      console.error("Delete locations error:", deleteError);
      return NextResponse.json(
        { error: "Failed to update locations", details: deleteError.message },
        { status: 500 }
      );
    }

    // Insert new associations
    if (locationIds.length > 0) {
      const inserts = locationIds.map((locationId: string) => ({
        serviceId,
        locationId,
      }));

      const { error: insertError } = await supabase
        .from(tables.serviceLocations)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .insert(inserts);

      if (insertError) {
        console.error("Insert locations error:", insertError);
        return NextResponse.json(
          { error: "Failed to update locations", details: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, locationIds });
  } catch (error) {
    console.error("Update locations error:", error);
    return NextResponse.json({ error: "Failed to update locations" }, { status: 500 });
  }
}
