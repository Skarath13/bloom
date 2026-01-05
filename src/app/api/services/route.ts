import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ServiceLocationData {
  serviceId: string;
  locationId: string;
  bloom_services: ServiceData;
}

/**
 * GET /api/services
 * Fetch services, optionally filtered by location
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");

    let services: ServiceData[] = [];

    if (locationId) {
      // Fetch services available at this location via junction table
      const { data, error } = await supabase
        .from(tables.serviceLocations)
        .select(`
          serviceId,
          locationId,
          bloom_services (
            id,
            name,
            description,
            category,
            durationMinutes,
            price,
            depositAmount,
            color,
            isActive,
            sortOrder
          )
        `)
        .eq("locationId", locationId) as { data: ServiceLocationData[] | null; error: { message: string } | null };

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json(
          { error: "Failed to fetch services", details: error.message },
          { status: 500 }
        );
      }

      // Extract services from junction table results and filter active only
      services = (data || [])
        .map((sl) => sl.bloom_services)
        .filter((s): s is ServiceData => s !== null && s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    } else {
      // Fetch all active services
      const { data, error } = await supabase
        .from(tables.services)
        .select("*")
        .eq("isActive", true)
        .order("sortOrder", { ascending: true }) as { data: ServiceData[] | null; error: { message: string } | null };

      if (error) {
        console.error("Fetch services error:", error);
        return NextResponse.json(
          { error: "Failed to fetch services", details: error.message },
          { status: 500 }
        );
      }

      services = data || [];
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
