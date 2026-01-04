import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingSteps } from "@/components/booking/booking-steps";

// Locations (will come from database later via API)
const locations = [
  {
    slug: "irvine",
    name: "Irvine",
    address: "15333 Culver Dr #220",
    city: "Irvine, CA 92604",
  },
  {
    slug: "tustin",
    name: "Tustin",
    address: "13112 Newport Ave #K",
    city: "Tustin, CA 92780",
  },
  {
    slug: "santa-ana",
    name: "Santa Ana",
    address: "3740 S Bristol St",
    city: "Santa Ana, CA 92704",
  },
  {
    slug: "costa-mesa",
    name: "Costa Mesa",
    address: "435 E 17th St #3",
    city: "Costa Mesa, CA 92627",
  },
  {
    slug: "newport-beach",
    name: "Newport Beach",
    address: "359 San Miguel Dr #107",
    city: "Newport Beach, CA 92660",
  },
];

export default function BookingPage() {
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
                <p className="text-sm text-muted-foreground">{location.city}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
