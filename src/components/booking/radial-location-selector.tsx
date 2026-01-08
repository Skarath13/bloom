"use client";

import Link from "next/link";
import { MapPin, Shield, Star, Clock } from "lucide-react";
import { useBooking } from "./booking-context";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RadialLocationSelectorProps {
  locations: Location[];
}

export function RadialLocationSelector({ locations }: RadialLocationSelectorProps) {
  const { setLocation, resetBooking } = useBooking();

  const handleLocationClick = (location: Location) => {
    // Always start fresh when selecting a location - if user is back at step 1,
    // they likely want to change their selection rather than continue
    resetBooking();
    setLocation(location.id, location.name, location.slug);
  };

  // Empty state
  if (locations.length === 0) {
    return (
      <div className="h-screen-mobile flex flex-col items-center justify-center px-4 safe-area-inset-top safe-area-inset-bottom">
        <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No locations available</p>
        <p className="text-xs text-muted-foreground mt-1">Please check back later</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen-mobile flex flex-col safe-area-inset-top safe-area-inset-bottom">
      {/* Header Section */}
      <div className="flex-shrink-0 pt-6 pb-4 flex flex-col items-center px-4">
        <div className="w-80 h-20 overflow-hidden">
          <img
            src="/logo.webp"
            alt="Elegant Lashes by Katie"
            className="w-full h-full object-contain scale-150"
          />
        </div>
        <h1 className="text-xl font-bold mt-3 text-foreground">Book Your Glow</h1>
        <p className="text-sm text-muted-foreground">
          {locations.length} Premier Orange County Location{locations.length !== 1 ? "s" : ""}
        </p>
      </div>


      {/* Location Grid - Pentagon/Circular arrangement */}
      <div className="flex-1 flex items-center justify-center px-4 -mt-8">
        <div className="relative w-full max-w-[320px] aspect-square">
          {/* Center pulsing icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
            <div className="w-16 h-16 bg-primary/5 rounded-full animate-pulse flex items-center justify-center">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>

          {/* Location buttons in circular pattern */}
          {locations.slice(0, 5).map((location, index) => {
            const position = getPosition(index, Math.min(locations.length, 5));

            return (
              <Link
                key={location.id}
                href={`/book/${location.slug}`}
                onClick={() => handleLocationClick(location)}
                className="absolute z-10"
                style={{
                  left: position.left,
                  top: position.top,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <LocationButton location={location} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Social Proof Footer */}
      <div className="flex-shrink-0 pb-6 px-4">
        {/* Trust Indicators */}
        <div className="flex justify-center gap-4 mb-3">
          <span className="flex items-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 mr-1 text-green-600" />
            Licensed
          </span>
          <span className="flex items-center text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 mr-1 text-yellow-500 fill-yellow-500" />
            5.0 Rating
          </span>
          <span className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 mr-1 text-blue-500" />
            Same-Day
          </span>
        </div>

        {/* Social Proof */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-pink-200 border-2 border-background" />
              <div className="w-6 h-6 rounded-full bg-purple-200 border-2 border-background" />
              <div className="w-6 h-6 rounded-full bg-blue-200 border-2 border-background" />
            </div>
            <span className="text-sm text-muted-foreground">
              Trusted by 2,500+ clients
            </span>
          </div>

          {/* Footer contact info */}
          <p className="text-xs text-muted-foreground">
            Questions? Text us at 657-334-9919
          </p>
        </div>
      </div>
    </div>
  );
}

// Pre-calculated positions for consistent SSR/client hydration
// Pentagon layout starting from top, going clockwise
const POSITIONS: Record<number, Array<{ left: string; top: string }>> = {
  1: [
    { left: "50%", top: "50%" },
  ],
  2: [
    { left: "35%", top: "50%" },
    { left: "65%", top: "50%" },
  ],
  3: [
    { left: "50%", top: "25%" },
    { left: "70%", top: "62%" },
    { left: "30%", top: "62%" },
  ],
  4: [
    { left: "50%", top: "20%" },
    { left: "80%", top: "50%" },
    { left: "50%", top: "80%" },
    { left: "20%", top: "50%" },
  ],
  5: [
    { left: "50%", top: "8%" },      // Top
    { left: "88%", top: "38%" },     // Top-right
    { left: "73%", top: "82%" },     // Bottom-right
    { left: "27%", top: "82%" },     // Bottom-left
    { left: "12%", top: "38%" },     // Top-left
  ],
};

function getPosition(index: number, total: number): { left: string; top: string } {
  const positions = POSITIONS[total] || POSITIONS[5];
  return positions[index] || { left: "50%", top: "50%" };
}

function LocationButton({ location }: { location: Location }) {
  const displayName = location.city;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "w-[135px] h-[135px] rounded-full",
        "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400",
        "border-2 border-border shadow-lg",
        "hover:border-primary hover:shadow-xl hover:scale-105",
        "transition-all duration-200 cursor-pointer",
        "active:scale-95",
        "overflow-hidden"
      )}
    >
      {/* Subtle map-like pattern overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.4)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(0,0,0,0.1)_0%,transparent_40%)]" />
      </div>

      {/* Map pin icon */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="w-8 h-8 mb-1">
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-md">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="#EA4335"
              stroke="#B91C1C"
              strokeWidth="0.5"
            />
            <circle cx="12" cy="9" r="2.5" fill="#B91C1C" />
          </svg>
        </div>
        <span className="text-base font-bold text-slate-800 text-center leading-tight px-2 line-clamp-2">
          {displayName}
        </span>
      </div>
    </div>
  );
}
