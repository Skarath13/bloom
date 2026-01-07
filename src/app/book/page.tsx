import { BookingSteps } from "@/components/booking/booking-steps";
import { LocationSelector } from "@/components/booking/location-selector";
import { supabase, tables } from "@/lib/supabase";

// Fetch locations from database
async function getLocations() {
  const { data: locations, error } = await supabase
    .from(tables.locations)
    .select("id, name, slug, address, city, state, zipCode, phone")
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

  return (
    <>
      <BookingSteps currentStep={1} />

      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground">
          Select a Location
        </h2>
        <p className="text-muted-foreground mt-1">
          Choose the location nearest to you
        </p>
      </div>

      <LocationSelector locations={locations} />
    </>
  );
}
