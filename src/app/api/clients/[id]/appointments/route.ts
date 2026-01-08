import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface AppointmentRow {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  noShowProtected: boolean;
  service: { id: string; name: string; price: number; durationMinutes: number } | null;
  technician: { id: string; firstName: string; lastName: string; color: string } | null;
  location: { id: string; name: string; slug: string; city: string | null } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    const { data: appointments, error } = await supabase
      .from("bloom_appointments")
      .select(`
        id,
        startTime,
        endTime,
        status,
        noShowProtected,
        service:bloom_services(id, name, price, durationMinutes),
        technician:bloom_technicians(id, firstName, lastName, color),
        location:bloom_locations(id, name, slug, city)
      `)
      .eq("clientId", clientId)
      .order("startTime", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // Transform to match expected format (including IDs for rebooking)
    const formattedAppointments = ((appointments || []) as AppointmentRow[]).map((apt) => ({
      id: apt.id,
      serviceName: apt.service?.name || "Unknown Service",
      serviceId: apt.service?.id || null,
      servicePrice: apt.service?.price || 0,
      serviceDuration: apt.service?.durationMinutes || 60,
      technicianName: apt.technician
        ? `${apt.technician.firstName} ${apt.technician.lastName}`
        : "Unknown",
      technicianId: apt.technician?.id || null,
      technicianColor: apt.technician?.color || "#9ca3af",
      locationName: apt.location?.city || apt.location?.name || "Unknown",
      locationId: apt.location?.id || null,
      locationSlug: apt.location?.slug || null,
      startTime: apt.startTime,
      status: apt.status,
      noShowProtected: apt.noShowProtected || false,
    }));

    return NextResponse.json({ appointments: formattedAppointments });
  } catch (error) {
    console.error("Fetch client appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client appointments" },
      { status: 500 }
    );
  }
}
