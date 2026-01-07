import { NextRequest, NextResponse } from "next/server";
import { supabase, generateId, tables } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    // If filtering by location, first get technician IDs that work at this location
    let technicianIds: string[] | null = null;
    if (locationId) {
      const { data: techLocations, error: locError } = await supabase
        .from("bloom_technician_locations")
        .select("technicianId")
        .eq("locationId", locationId);

      if (locError) {
        console.error("Error fetching technician locations:", locError);
        throw locError;
      }

      technicianIds = (techLocations as { technicianId: string }[] | null)?.map((tl) => tl.technicianId) || [];

      // If no technicians at this location, return empty array
      if (technicianIds.length === 0) {
        return NextResponse.json({ technicians: [] });
      }
    }

    // Query technicians with all their locations
    let query = supabase
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
        badges,
        sortOrder,
        locationId,
        createdAt,
        updatedAt,
        locations:bloom_technician_locations(
          location:bloom_locations(id, name, city)
        ),
        schedules:bloom_technician_schedules(id, dayOfWeek, startTime, endTime, isWorking)
      `)
      .order("firstName", { ascending: true });

    // Filter by technician IDs if locationId was provided
    if (technicianIds) {
      query = query.in("id", technicianIds);
    }

    if (activeOnly) {
      query = query.eq("isActive", true);
    }

    const { data: technicians, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // Transform the nested locations structure to a flat array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedTechnicians = ((technicians || []) as any[]).map((tech) => ({
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
      badges: tech.badges || null,
      sortOrder: tech.sortOrder,
      locationId: tech.locationId,
      createdAt: tech.createdAt,
      updatedAt: tech.updatedAt,
      schedules: tech.schedules,
      // Flatten: [{location: {id, name, city}}] -> [{id, name, city}]
      locations: (tech.locations || [])
        .map((l: { location: { id: string; name: string; city: string } | null }) => l.location)
        .filter(Boolean),
    }));

    return NextResponse.json({ technicians: transformedTechnicians });
  } catch (error) {
    console.error("Fetch technicians error:", error);
    return NextResponse.json(
      { error: "Failed to fetch technicians" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, description, badges, color, locationIds, isActive = true, hasMasterFee = false } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return NextResponse.json(
        { error: "At least one location is required" },
        { status: 400 }
      );
    }

    const technicianId = generateId();

    // Create the technician (use first location as primary for backwards compatibility)
    const { error: techError } = await supabase
      .from("bloom_technicians")
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert({
        id: technicianId,
        firstName,
        lastName,
        description: description || null,
        badges: badges || null,
        color: color || "#7CB342",
        isActive,
        hasMasterFee,
        locationId: locationIds[0], // Primary location for backwards compat
        defaultBufferMinutes: 0,
        sortOrder: 0,
      });

    if (techError) {
      console.error("Error creating technician:", techError);
      throw techError;
    }

    // Create location assignments
    const locationAssignments = locationIds.map((locId: string) => ({
      technicianId,
      locationId: locId,
    }));

    const { error: locError } = await supabase
      .from("bloom_technician_locations")
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert(locationAssignments);

    if (locError) {
      console.error("Error creating location assignments:", locError);
      throw locError;
    }

    // Create default schedule (Mon-Sat 9am-7pm, Sun off)
    const defaultSchedule = [
      { technicianId, dayOfWeek: 0, startTime: "09:00", endTime: "19:00", isWorking: false },
      { technicianId, dayOfWeek: 1, startTime: "09:00", endTime: "19:00", isWorking: true },
      { technicianId, dayOfWeek: 2, startTime: "09:00", endTime: "19:00", isWorking: true },
      { technicianId, dayOfWeek: 3, startTime: "09:00", endTime: "19:00", isWorking: true },
      { technicianId, dayOfWeek: 4, startTime: "09:00", endTime: "19:00", isWorking: true },
      { technicianId, dayOfWeek: 5, startTime: "09:00", endTime: "19:00", isWorking: true },
      { technicianId, dayOfWeek: 6, startTime: "09:00", endTime: "19:00", isWorking: true },
    ];

    const { error: schedError } = await supabase
      .from("bloom_technician_schedules")
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert(defaultSchedule);

    if (schedError) {
      console.error("Error creating default schedule:", schedError);
      // Non-fatal - technician was created
    }

    return NextResponse.json({
      success: true,
      technician: { id: technicianId, firstName, lastName }
    });
  } catch (error) {
    console.error("Create technician error:", error);
    return NextResponse.json(
      { error: "Failed to create technician" },
      { status: 500 }
    );
  }
}
