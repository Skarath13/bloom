"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

interface MiniLocationMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

// Loading skeleton for the mini-map
function MapSkeleton({ className = "" }: { className?: string }) {
  return (
    <Skeleton className={`w-full bg-slate-100 ${className}`} />
  );
}

// Dynamic import to prevent SSR issues with Leaflet
const MiniLocationMapInner = dynamic(
  () =>
    import("./mini-location-map-inner").then((mod) => mod.MiniLocationMapInner),
  {
    ssr: false,
    loading: () => <MapSkeleton className="h-[80px] rounded-t-xl" />,
  }
);

export function MiniLocationMap({
  latitude,
  longitude,
  className = "",
}: MiniLocationMapProps) {
  return (
    <MiniLocationMapInner
      latitude={latitude}
      longitude={longitude}
      className={className}
    />
  );
}
