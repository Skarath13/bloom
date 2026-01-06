import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

interface ServiceTechnicianSetting {
  serviceId: string;
  isEnabled: boolean;
  customDurationMinutes: number | null;
}

/**
 * GET /api/technicians/[id]/services
 * Get all service settings for a technician
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: technicianId } = await params;

    const { data, error } = await supabase
      .from(tables.serviceTechnicians)
      .select("serviceId, isEnabled, customDurationMinutes")
      .eq("technicianId", technicianId);

    if (error) {
      console.error("Fetch technician services error:", error);
      return NextResponse.json(
        { error: "Failed to fetch services", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ services: data || [] });
  } catch (error) {
    console.error("Fetch technician services error:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

/**
 * PUT /api/technicians/[id]/services
 * Update all service settings for a technician (batch update)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: technicianId } = await params;
    const body = await request.json();
    const { services } = body as { services: ServiceTechnicianSetting[] };

    if (!Array.isArray(services)) {
      return NextResponse.json(
        { error: "services must be an array" },
        { status: 400 }
      );
    }

    // Delete all existing settings for this technician
    const { error: deleteError } = await supabase
      .from(tables.serviceTechnicians)
      .delete()
      .eq("technicianId", technicianId);

    if (deleteError) {
      console.error("Delete technician services error:", deleteError);
      return NextResponse.json(
        { error: "Failed to update services", details: deleteError.message },
        { status: 500 }
      );
    }

    // Insert new settings (only for enabled services or those with custom durations)
    const toInsert = services
      .filter((s) => s.isEnabled || s.customDurationMinutes !== null)
      .map((s) => ({
        id: generateId(),
        technicianId,
        serviceId: s.serviceId,
        isEnabled: s.isEnabled,
        customDurationMinutes: s.customDurationMinutes,
      }));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from(tables.serviceTechnicians)
        // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
        .insert(toInsert);

      if (insertError) {
        console.error("Insert technician services error:", insertError);
        return NextResponse.json(
          { error: "Failed to update services", details: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, count: toInsert.length });
  } catch (error) {
    console.error("Update technician services error:", error);
    return NextResponse.json({ error: "Failed to update services" }, { status: 500 });
  }
}
