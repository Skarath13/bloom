import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: technician, error } = await supabase
      .from(tables.technicians)
      .select(`
        id,
        firstName,
        lastName,
        description,
        email,
        phone,
        color,
        avatarUrl,
        defaultBufferMinutes,
        isActive,
        hasMasterFee,
        sortOrder,
        locationId,
        createdAt,
        updatedAt,
        locations:bloom_technician_locations(
          location:bloom_locations(id, name, city)
        ),
        schedules:bloom_technician_schedules(id, dayOfWeek, startTime, endTime, isWorking)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Technician not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    if (!technician) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 }
      );
    }

    // Transform locations to flat array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tech = technician as any;
    const transformedTechnician = {
      id: tech.id,
      firstName: tech.firstName,
      lastName: tech.lastName,
      description: tech.description,
      email: tech.email,
      phone: tech.phone,
      color: tech.color,
      avatarUrl: tech.avatarUrl,
      defaultBufferMinutes: tech.defaultBufferMinutes,
      isActive: tech.isActive,
      hasMasterFee: tech.hasMasterFee || false,
      sortOrder: tech.sortOrder,
      locationId: tech.locationId,
      createdAt: tech.createdAt,
      updatedAt: tech.updatedAt,
      schedules: tech.schedules,
      locations: (tech.locations || [])
        .map((l: { location: { id: string; name: string; city: string } | null }) => l.location)
        .filter(Boolean),
    };

    return NextResponse.json({ technician: transformedTechnician });
  } catch (error) {
    console.error("Fetch technician error:", error);
    return NextResponse.json(
      { error: "Failed to fetch technician" },
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
    const { firstName, lastName, description, color, locationIds, isActive, hasMasterFee } = body;

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (hasMasterFee !== undefined) updateData.hasMasterFee = hasMasterFee;

    // Update primary locationId if locationIds provided
    if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
      updateData.locationId = locationIds[0];
    }

    // Update technician
    const { error: techError } = await supabase
      .from("bloom_technicians")
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update(updateData)
      .eq("id", id);

    if (techError) {
      console.error("Error updating technician:", techError);
      throw techError;
    }

    // Update location assignments if provided
    if (locationIds && Array.isArray(locationIds)) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("bloom_technician_locations")
        .delete()
        .eq("technicianId", id);

      if (deleteError) {
        console.error("Error deleting location assignments:", deleteError);
        throw deleteError;
      }

      // Create new assignments
      if (locationIds.length > 0) {
        const locationAssignments = locationIds.map((locId: string) => ({
          technicianId: id,
          locationId: locId,
        }));

        const { error: insertError } = await supabase
          .from("bloom_technician_locations")
          // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
          .insert(locationAssignments);

        if (insertError) {
          console.error("Error inserting location assignments:", insertError);
          throw insertError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update technician error:", error);
    return NextResponse.json(
      { error: "Failed to update technician" },
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

    // Check if technician has appointments
    const { data: appointments, error: checkError } = await supabase
      .from(tables.appointments)
      .select("id")
      .eq("technicianId", id)
      .limit(1);

    if (checkError) {
      console.error("Error checking appointments:", checkError);
      throw checkError;
    }

    if (appointments && appointments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete technician with existing appointments. Deactivate instead." },
        { status: 400 }
      );
    }

    // Delete technician (cascade will delete from join tables)
    const { error } = await supabase
      .from(tables.technicians)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting technician:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete technician error:", error);
    return NextResponse.json(
      { error: "Failed to delete technician" },
      { status: 500 }
    );
  }
}
