import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: location, error } = await supabase
      .from(tables.locations)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ location });
  } catch (error) {
    console.error("Fetch location error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode;
    if (body.phone !== undefined) updateData.phone = body.phone.replace(/\D/g, "");
    if (body.operatingHours !== undefined) updateData.operatingHours = body.operatingHours;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const { data: location, error } = await supabase
      .from(tables.locations)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ location });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if location has technicians
    const { data: techLocations, error: checkError } = await supabase
      .from(tables.technicianLocations)
      .select("id")
      .eq("locationId", id)
      .limit(1);

    if (checkError) throw checkError;

    if (techLocations && techLocations.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete location with assigned technicians" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from(tables.locations)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete location error:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}
