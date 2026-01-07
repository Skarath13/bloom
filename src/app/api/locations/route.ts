import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const includeTechnicianCount = searchParams.get("includeTechnicianCount") === "true";

    let query = supabase
      .from(tables.locations)
      .select("*")
      .order("sortOrder", { ascending: true });

    if (activeOnly) {
      query = query.eq("isActive", true);
    }

    const { data: locations, error } = await query;

    if (error) throw error;

    // Get technician counts if requested
    if (includeTechnicianCount && locations) {
      const { data: techLocations, error: techError } = await supabase
        .from(tables.technicianLocations)
        .select("locationId");

      if (techError) throw techError;

      // Count technicians per location
      const countMap: Record<string, number> = {};
      techLocations?.forEach((tl) => {
        countMap[tl.locationId] = (countMap[tl.locationId] || 0) + 1;
      });

      // Add counts to locations
      const locationsWithCounts = locations.map((loc) => ({
        ...loc,
        technicianCount: countMap[loc.id] || 0,
      }));

      return NextResponse.json({ locations: locationsWithCounts });
    }

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Fetch locations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, address, city, state, zipCode, phone, operatingHours, isActive } = body;

    if (!name || !address || !city || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get max sortOrder
    const { data: maxSort } = await supabase
      .from(tables.locations)
      .select("sortOrder")
      .order("sortOrder", { ascending: false })
      .limit(1)
      .single();

    const newLocation = {
      id: generateId(),
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      address,
      city,
      state: state || "CA",
      zipCode: zipCode || "",
      phone: phone.replace(/\D/g, ""),
      timezone: "America/Los_Angeles",
      operatingHours: operatingHours || getDefaultOperatingHours(),
      isActive: isActive ?? true,
      sortOrder: (maxSort?.sortOrder || 0) + 1,
    };

    const { data: location, error } = await supabase
      .from(tables.locations)
      .insert(newLocation)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ location });
  } catch (error) {
    console.error("Create location error:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}

function getDefaultOperatingHours() {
  return {
    sunday: { open: null, close: null, isOpen: false },
    monday: { open: "09:00", close: "19:00", isOpen: true },
    tuesday: { open: "09:00", close: "19:00", isOpen: true },
    wednesday: { open: "09:00", close: "19:00", isOpen: true },
    thursday: { open: "09:00", close: "19:00", isOpen: true },
    friday: { open: "09:00", close: "19:00", isOpen: true },
    saturday: { open: "09:00", close: "19:00", isOpen: true },
  };
}
