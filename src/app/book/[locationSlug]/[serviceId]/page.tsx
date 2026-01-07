import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { TechnicianGrid } from "@/components/booking/technician-grid";
import { supabase, tables } from "@/lib/supabase";

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
    .select("id, firstName, lastName, description, color")
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

  return (
    <BookingLayoutWrapper currentStep={3}>
      {/* Back button and selection info */}
      <div className="mb-4">
        <Link href={`/book/${locationSlug}`}>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">{location.name}</Badge>
          <Badge variant="outline" className="text-xs">{service.name}</Badge>
          <span className="font-semibold text-primary">${service.price}</span>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">Choose Your Tech</h2>
        <p className="text-sm text-muted-foreground mt-1">Select a technician or let us pick for you</p>
      </div>

      {/* Randomized Technician Grid */}
      <TechnicianGrid
        technicians={technicians}
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
