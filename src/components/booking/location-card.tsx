"use client";

import Link from "next/link";
import { MiniLocationMap } from "./mini-location-map";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface LocationCardProps {
  location: Location;
  onClick?: () => void;
}

export function LocationCard({ location, onClick }: LocationCardProps) {
  const hasCoordinates =
    location.latitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined;

  return (
    <Link
      href={`/book/${location.slug}`}
      onClick={onClick}
      className={cn(
        "block rounded-xl overflow-hidden",
        "bg-white border border-slate-200",
        "shadow-sm hover:shadow-md",
        "transition-all duration-200",
        "active:scale-[0.98] active:shadow-sm",
        // Safari/WebKit optimizations
        "select-none",
        "-webkit-tap-highlight-color-transparent"
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        minHeight: "160px",
      }}
    >
      {/* Mini Map */}
      {hasCoordinates ? (
        <div className="h-[80px] w-full overflow-hidden pointer-events-none">
          <MiniLocationMap
            latitude={location.latitude!}
            longitude={location.longitude!}
            className="h-[80px] w-full"
          />
        </div>
      ) : (
        <div className="h-[80px] w-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-[#8B687A]/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#8B687A]" />
          </div>
        </div>
      )}

      {/* Location Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-slate-900 leading-tight">
          {location.city}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">
          {location.address}
          <br />
          {location.city}, {location.state} {location.zipCode}
        </p>
      </div>
    </Link>
  );
}
