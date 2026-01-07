"use client";

import Link from "next/link";
import { MapPin, Shield, Star, Clock, RotateCcw } from "lucide-react";
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
  const { setLocation, state, getResumeUrl, getCurrentStep, resetBooking } = useBooking();
  const resumeUrl = getResumeUrl();
  const currentStep = getCurrentStep();
  const hasBookingInProgress = currentStep > 1;

  const handleLocationClick = (location: Location) => {
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

      {/* Resume Booking Banner */}
      {resumeUrl && currentStep > 1 && (
        <div className="px-4 pb-4">
          <Link href={resumeUrl}>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center hover:bg-primary/15 transition-colors">
              <p className="text-sm font-medium text-primary">
                Continue your booking
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state.locationName} • {state.serviceName || "Step " + currentStep}
              </p>
            </div>
          </Link>
        </div>
      )}

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

          {/* Start over - only show if there's a booking in progress */}
          {hasBookingInProgress && (
            <button
              onClick={() => resetBooking()}
              className="mt-2 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Start over
            </button>
          )}
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

  // Use coordinates if available (cleaner, no business labels), otherwise use address
  const hasCoords = location.latitude && location.longitude;

  // Free Google Maps embed URL (no API key needed)
  // Using coordinates avoids business label text on pins, satellite view (t=k)
  const mapEmbedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=13&t=k&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(`${location.address}, ${location.city}, ${location.state} ${location.zipCode}`)}&z=13&t=k&output=embed`;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "w-[135px] h-[135px] rounded-full",
        "bg-card border-2 border-border shadow-lg",
        "hover:border-primary hover:shadow-xl hover:scale-105",
        "transition-all duration-200 cursor-pointer",
        "active:scale-95",
        "overflow-hidden"
      )}
    >
      {/* Map background */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <iframe
          src={mapEmbedUrl}
          className="w-[270px] h-[270px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map of ${location.name}`}
        />
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center mt-14">
        <span
          className="text-base font-bold text-white text-center leading-tight px-2 line-clamp-2"
          style={{
            textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 4px #000"
          }}
        >
          {displayName}
        </span>
      </div>
    </div>
  );
}
