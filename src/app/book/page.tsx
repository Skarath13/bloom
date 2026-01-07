import { RadialLocationSelector } from "@/components/booking/radial-location-selector";
import { supabase, tables } from "@/lib/supabase";

// Fetch locations from database
async function getLocations() {
  const { data: locations, error } = await supabase
    .from(tables.locations)
    .select("id, name, slug, address, city, state, zipCode, phone, latitude, longitude")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Failed to fetch locations:", error);
    return [];
  }

  return locations || [];
}

export default async function BookingPage() {
  const locations = await getLocations();

  return <RadialLocationSelector locations={locations} />;
}
