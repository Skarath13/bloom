"use client";

import dynamic from "next/dynamic";

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
}

// Dynamic import to prevent SSR issues with Leaflet
const LocationMap = dynamic(
  () => import("./location-map").then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] md:h-[600px] w-full bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-12 h-12 mx-auto mb-3 bg-muted-foreground/20 rounded-full" />
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </div>
    ),
  }
);

interface LocationMapWrapperProps {
  locations: Location[];
}

export function LocationMapWrapper({ locations }: LocationMapWrapperProps) {
  return <LocationMap locations={locations} />;
}
