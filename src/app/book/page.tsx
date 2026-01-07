import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingSteps } from "@/components/booking/booking-steps";
import { supabase, tables } from "@/lib/supabase";

// Fetch locations from database
async function getLocations() {
  const { data: locations, error } = await supabase
    .from(tables.locations)
    .select("*")
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
        <h2 className="text-2xl font-semibold text-foreground">Select a Location</h2>
        <p className="text-muted-foreground mt-1">Choose the location nearest to you</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Link key={location.slug} href={`/book/${location.slug}`}>
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {location.name}
                </CardTitle>
                <CardDescription>{location.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {location.city}, {location.state} {location.zipCode}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
