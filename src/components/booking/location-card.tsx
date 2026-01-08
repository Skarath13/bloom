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

// Cities where we hide the state to save space
const HIDE_STATE_FOR_CITIES = ["Newport Beach"];

export function LocationCard({ location, onClick }: LocationCardProps) {
  const hasCoordinates =
    location.latitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined;

  // Hide state for certain cities to save space
  const hideState = HIDE_STATE_FOR_CITIES.includes(location.city);

  return (
    <Link
      href={`/book/${location.slug}`}
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden",
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
        minHeight: "176px",
      }}
    >
      {/* Mini Map - full bleed background */}
      {hasCoordinates ? (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <MiniLocationMap
            latitude={location.latitude!}
            longitude={location.longitude!}
          />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-[#8B687A]/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#8B687A]" />
          </div>
        </div>
      )}

      {/* Location Info - faded transparent overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Gradient fade */}
        <div className="h-6" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.5))" }} />
        {/* Text area */}
        <div className="px-3 py-2 bg-white/50">
          <h3 className="font-semibold text-sm text-slate-900 leading-tight drop-shadow-sm">
            {location.city}
          </h3>
          <p className="text-xs text-slate-700 mt-0.5 leading-snug line-clamp-2 drop-shadow-sm">
            {location.address}
            <br />
            {hideState
              ? `${location.city}, ${location.zipCode}`
              : `${location.city}, ${location.state} ${location.zipCode}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
