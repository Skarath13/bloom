import { notFound } from "next/navigation";
import { supabase, tables } from "@/lib/supabase";
import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { ServiceSelector } from "@/components/booking/service-selector";

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

// Fetch services for a location, grouped by category
async function getServicesByCategory(locationId: string) {
  // Fetch services available at this location via junction table
  const { data, error } = await supabase
    .from(tables.serviceLocations)
    .select(`
      serviceId,
      bloom_services (*)
    `)
    .eq("locationId", locationId);

  if (error) {
    console.error("Failed to fetch services:", error);
    return {};
  }

  // Extract services and filter active ones
  const services = (data || [])
    .map((sl: { bloom_services: { id: string; name: string; description: string | null; category: string; durationMinutes: number; price: number; depositAmount: number; isActive: boolean; sortOrder: number } }) => sl.bloom_services)
    .filter((s): s is NonNullable<typeof s> => s !== null && s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Group by category
  const grouped: Record<string, typeof services> = {};
  for (const service of services) {
    if (!grouped[service.category]) {
      grouped[service.category] = [];
    }
    grouped[service.category].push(service);
  }

  return grouped;
}

interface PageProps {
  params: Promise<{ locationSlug: string }>;
}

export default async function ServiceSelectionPage({ params }: PageProps) {
  const { locationSlug } = await params;
  const location = await getLocation(locationSlug);

  if (!location) {
    notFound();
  }

  const servicesByCategory = await getServicesByCategory(location.id);

  return (
    <BookingLayoutWrapper currentStep={2}>
      <ServiceSelector
        locationSlug={locationSlug}
        locationId={location.id}
        locationName={location.name}
        servicesByCategory={servicesByCategory}
      />
    </BookingLayoutWrapper>
  );
}
