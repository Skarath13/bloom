"use client";

import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

interface LocationSelectorProps {
  locations: Location[];
}

// Generate Google Maps embed URL from address
function getGoogleMapsEmbedUrl(location: Location): string {
  const address = encodeURIComponent(
    `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
  );
  return `https://www.google.com/maps?q=${address}&output=embed&z=16`;
}

export function LocationSelector({ locations }: LocationSelectorProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {locations.map((location) => (
        <Card
          key={location.id}
          className="overflow-hidden hover:shadow-lg transition-shadow"
        >
          {/* Google Maps Embed */}
          <div className="relative h-48 bg-slate-100">
            <iframe
              src={getGoogleMapsEmbedUrl(location)}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map of ${location.name}`}
            />
          </div>

          <CardContent className="p-5">
            {/* Location Name */}
            <h3 className="flex items-center gap-2 font-semibold text-lg mb-2">
              <MapPin className="h-5 w-5 text-[#8B687A]" />
              {location.name}
            </h3>

            {/* Address */}
            <p className="text-sm text-muted-foreground mb-1">
              {location.address}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {location.city}, {location.state} {location.zipCode}
            </p>

            {/* Phone */}
            {location.phone && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Phone className="h-4 w-4" />
                {location.phone}
              </p>
            )}

            {/* Book Button */}
            <Link href={`/book/${location.slug}`}>
              <Button className="w-full bg-[#8B687A] hover:bg-[#6d5261]">
                Book {location.name}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
