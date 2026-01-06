import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  color: string | null;
  imageUrl: string | null;
  isVariablePrice: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface ServiceLocationData {
  serviceId: string;
  locationId: string;
}

/**
 * GET /api/services
 * Fetch services, optionally filtered by location
 * Query params:
 * - locationId: Filter by specific location
 * - includeInactive: Include inactive services (default: false)
 * - includeLocations: Include location IDs for each service (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const includeLocations = searchParams.get("includeLocations") === "true";

    let services: (ServiceData & { locationIds?: string[] })[] = [];

    if (locationId) {
      // Fetch services available at this location via junction table
      const { data, error } = await supabase
        .from(tables.serviceLocations)
        .select(`
          serviceId,
          locationId,
          bloom_services (*)
        `)
        .eq("locationId", locationId);

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json(
          { error: "Failed to fetch services", details: error.message },
          { status: 500 }
        );
      }

      // Extract services from junction table results
      services = (data || [])
        .map((sl: { bloom_services: ServiceData }) => sl.bloom_services)
        .filter((s): s is ServiceData => {
          if (!s) return false;
          return includeInactive || s.isActive;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
    } else {
      // Fetch all services
      let query = supabase
        .from(tables.services)
        .select("*")
        .order("sortOrder", { ascending: true });

      if (!includeInactive) {
        query = query.eq("isActive", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json(
          { error: "Failed to fetch services", details: error.message },
          { status: 500 }
        );
      }

      services = data || [];
    }

    // Include location IDs for each service if requested
    if (includeLocations && services.length > 0) {
      const serviceIds = services.map((s) => s.id);
      const { data: locationData, error: locationError } = await supabase
        .from(tables.serviceLocations)
        .select("serviceId, locationId")
        .in("serviceId", serviceIds);

      if (!locationError && locationData) {
        const locationMap = new Map<string, string[]>();
        (locationData as ServiceLocationData[]).forEach((sl) => {
          const existing = locationMap.get(sl.serviceId) || [];
          existing.push(sl.locationId);
          locationMap.set(sl.serviceId, existing);
        });

        services = services.map((s) => ({
          ...s,
          locationIds: locationMap.get(s.id) || [],
        }));
      }
    }

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Fetch services error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/services
 * Create a new service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      durationMinutes,
      price,
      depositAmount,
      isActive = true,
      isVariablePrice = false,
      imageUrl,
      locationIds = [],
    } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      );
    }

    const serviceId = generateId();

    // Get the highest sort order
    const { data: maxSortData } = await supabase
      .from(tables.services)
      .select("sortOrder")
      .order("sortOrder", { ascending: false })
      .limit(1)
      .single();

    const sortOrder = ((maxSortData as { sortOrder: number } | null)?.sortOrder || 0) + 1;

    // Create the service
    const { data: service, error: serviceError } = await supabase
      .from(tables.services)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert({
        id: serviceId,
        name,
        description: description || null,
        category,
        durationMinutes: durationMinutes || 60,
        price: price || 0,
        depositAmount: depositAmount || 25,
        isActive,
        isVariablePrice,
        imageUrl: imageUrl || null,
        sortOrder,
      })
      .select()
      .single();

    if (serviceError) {
      console.error("Create service error:", serviceError);
      return NextResponse.json(
        { error: "Failed to create service", details: serviceError.message },
        { status: 500 }
      );
    }

    // Create service-location associations
    if (locationIds.length > 0) {
      const locationInserts = locationIds.map((locationId: string) => ({
        serviceId,
        locationId,
      }));

      const { error: locationError } = await supabase
        .from(tables.serviceLocations)
        .insert(locationInserts);

      if (locationError) {
        console.error("Create service locations error:", locationError);
        // Don't fail the request, just log it
      }
    }

    return NextResponse.json({
      service: {
        ...(service as ServiceData),
        locationIds,
      },
    });
  } catch (error) {
    console.error("Create service error:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
