"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

interface MiniLocationMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

// Loading skeleton for the mini-map
function MapSkeleton() {
  return (
    <Skeleton className="w-full h-full bg-slate-100" />
  );
}

// Dynamic import to prevent SSR issues with Leaflet
const MiniLocationMapInner = dynamic(
  () =>
    import("./mini-location-map-inner").then((mod) => mod.MiniLocationMapInner),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
);

export function MiniLocationMap({
  latitude,
  longitude,
  className = "",
}: MiniLocationMapProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <MiniLocationMapInner
        latitude={latitude}
        longitude={longitude}
        className="w-full h-full"
      />
    </div>
  );
}
