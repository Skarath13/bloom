import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * GET /api/services/[id]
 * Get a single service by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: service, error } = await supabase
      .from(tables.services)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to fetch service", details: error.message },
        { status: 500 }
      );
    }

    // Get location IDs
    const { data: locations } = await supabase
      .from(tables.serviceLocations)
      .select("locationId")
      .eq("serviceId", id);

    return NextResponse.json({
      service: {
        ...(service as Record<string, unknown>),
        locationIds: (locations || []).map((l: { locationId: string }) => l.locationId),
      },
    });
  } catch (error) {
    console.error("Fetch service error:", error);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}

/**
 * PUT /api/services/[id]
 * Update a service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "description",
      "category",
      "durationMinutes",
      "price",
      "depositAmount",
      "isActive",
      "isVariablePrice",
      "imageUrl",
      "color",
      "sortOrder",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: service, error } = await supabase
      .from(tables.services)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update service error:", error);
      return NextResponse.json(
        { error: "Failed to update service", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Update service error:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[id]
 * Delete a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if service has any appointments
    const { data: appointments, error: checkError } = await supabase
      .from(tables.appointments)
      .select("id")
      .eq("serviceId", id)
      .limit(1);

    if (checkError) {
      console.error("Check appointments error:", checkError);
    }

    if (appointments && appointments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete service with existing appointments. Deactivate it instead." },
        { status: 400 }
      );
    }

    // Delete service-location associations first
    await supabase
      .from(tables.serviceLocations)
      .delete()
      .eq("serviceId", id);

    // Delete service-technician associations
    await supabase
      .from(tables.serviceTechnicians)
      .delete()
      .eq("serviceId", id);

    // Delete the service
    const { error } = await supabase
      .from(tables.services)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete service error:", error);
      return NextResponse.json(
        { error: "Failed to delete service", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete service error:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
