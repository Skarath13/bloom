import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { TechnicianGrid } from "@/components/booking/technician-grid";
import { supabase, tables } from "@/lib/supabase";
import { fisherYatesShuffle } from "@/lib/utils";

// Fetch location by slug
async function getLocation(slug: string) {
  const { data: location, error } = await supabase
    .from(tables.locations)
    .select("*")
    .eq("slug", slug)
    .eq("isActive", true)
    .single();

  if (error || !location) {
    return null;
  }

  return location;
}

// Fetch service by ID
async function getService(serviceId: string) {
  const { data: service, error } = await supabase
    .from(tables.services)
    .select("*")
    .eq("id", serviceId)
    .eq("isActive", true)
    .single();

  if (error || !service) {
    return null;
  }

  return service;
}

// Fetch technicians for a location
async function getTechnicians(locationId: string) {
  // First get technician IDs that work at this location
  const { data: techLocations, error: locError } = await supabase
    .from(tables.technicianLocations)
    .select("technicianId")
    .eq("locationId", locationId);

  if (locError || !techLocations || techLocations.length === 0) {
    return [];
  }

  const techIds = techLocations.map((tl) => tl.technicianId);

  // Fetch the technicians - no sorting, will be randomized client-side
  const { data: technicians, error } = await supabase
    .from(tables.technicians)
    .select("id, firstName, lastName, description, color, badges")
    .in("id", techIds)
    .eq("isActive", true);

  if (error) {
    console.error("Failed to fetch technicians:", error);
    return [];
  }

  return technicians || [];
}

interface PageProps {
  params: Promise<{ locationSlug: string; serviceId: string }>;
}

export default async function TechnicianSelectionPage({ params }: PageProps) {
  const { locationSlug, serviceId } = await params;
  const location = await getLocation(locationSlug);
  const service = await getService(serviceId);

  if (!location || !service) {
    notFound();
  }

  const technicians = await getTechnicians(location.id);
  // Randomize on the server to avoid hydration mismatch
  const randomizedTechnicians = fisherYatesShuffle(technicians);

  return (
    <BookingLayoutWrapper currentStep={3}>
      {/* Compact header with back button and title inline */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/book/${locationSlug}`}>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Choose Your Tech</h1>
          <p className="text-xs text-muted-foreground">
            {location.name} · {service.name} · <span className="font-semibold text-[#1E1B4B]">${service.price}</span>
          </p>
        </div>
      </div>

      {/* Randomized Technician Grid */}
      <TechnicianGrid
        technicians={randomizedTechnicians}
        locationSlug={locationSlug}
        serviceId={serviceId}
        serviceName={service.name}
        servicePrice={service.price}
        serviceDuration={service.durationMinutes}
        depositAmount={service.depositAmount}
      />
    </BookingLayoutWrapper>
  );
}
