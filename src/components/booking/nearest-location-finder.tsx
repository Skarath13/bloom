"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  latitude?: number | null;
  longitude?: number | null;
}

interface NearestLocationFinderProps {
  locations: Location[];
  className?: string;
}

type FinderState =
  | "idle"
  | "requesting_location"
  | "entering_zip"
  | "calculating"
  | "found"
  | "error";

// Orange County zip code to coordinates lookup (approximate centers)
const OC_ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  // Irvine
  "92602": { lat: 33.7366, lng: -117.7947 },
  "92603": { lat: 33.6469, lng: -117.7997 },
  "92604": { lat: 33.6906, lng: -117.7897 },
  "92606": { lat: 33.6972, lng: -117.8247 },
  "92612": { lat: 33.6597, lng: -117.8397 },
  "92614": { lat: 33.6847, lng: -117.8547 },
  "92617": { lat: 33.6447, lng: -117.8447 },
  "92618": { lat: 33.6647, lng: -117.7447 },
  "92620": { lat: 33.7147, lng: -117.7597 },
  // Tustin
  "92780": { lat: 33.7458, lng: -117.8131 },
  "92782": { lat: 33.7308, lng: -117.7931 },
  // Santa Ana
  "92701": { lat: 33.7455, lng: -117.8678 },
  "92703": { lat: 33.7605, lng: -117.8878 },
  "92704": { lat: 33.7155, lng: -117.9078 },
  "92705": { lat: 33.7605, lng: -117.8278 },
  "92706": { lat: 33.7505, lng: -117.8478 },
  "92707": { lat: 33.7105, lng: -117.8678 },
  // Costa Mesa
  "92626": { lat: 33.6639, lng: -117.9036 },
  "92627": { lat: 33.6439, lng: -117.9236 },
  "92628": { lat: 33.6339, lng: -117.9136 },
  // Newport Beach
  "92660": { lat: 33.6189, lng: -117.8767 },
  "92661": { lat: 33.6089, lng: -117.9067 },
  "92662": { lat: 33.6089, lng: -117.9167 },
  "92663": { lat: 33.6289, lng: -117.9267 },
  // Huntington Beach
  "92646": { lat: 33.6839, lng: -117.9786 },
  "92647": { lat: 33.7139, lng: -117.9986 },
  "92648": { lat: 33.6639, lng: -118.0086 },
  "92649": { lat: 33.7239, lng: -117.9586 },
  // Anaheim
  "92801": { lat: 33.8366, lng: -117.9143 },
  "92802": { lat: 33.8066, lng: -117.9243 },
  "92804": { lat: 33.8166, lng: -117.9643 },
  "92805": { lat: 33.8366, lng: -117.8943 },
  "92806": { lat: 33.8466, lng: -117.8543 },
  "92807": { lat: 33.8566, lng: -117.7643 },
  "92808": { lat: 33.8666, lng: -117.7243 },
  // Fullerton
  "92831": { lat: 33.8866, lng: -117.9143 },
  "92832": { lat: 33.8666, lng: -117.9243 },
  "92833": { lat: 33.8766, lng: -117.9543 },
  "92835": { lat: 33.8966, lng: -117.8943 },
  // Orange
  "92865": { lat: 33.8166, lng: -117.8543 },
  "92866": { lat: 33.7966, lng: -117.8443 },
  "92867": { lat: 33.8066, lng: -117.8143 },
  "92868": { lat: 33.7866, lng: -117.8743 },
  "92869": { lat: 33.8166, lng: -117.7643 },
  // Mission Viejo
  "92691": { lat: 33.5966, lng: -117.6643 },
  "92692": { lat: 33.6066, lng: -117.6443 },
  // Lake Forest
  "92630": { lat: 33.6466, lng: -117.6843 },
  // Laguna Beach
  "92651": { lat: 33.5427, lng: -117.7854 },
  // Laguna Niguel
  "92677": { lat: 33.5227, lng: -117.7054 },
};

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function NearestLocationFinder({
  locations,
  className,
}: NearestLocationFinderProps) {
  const router = useRouter();
  const { resetBooking, setLocation } = useBooking();
  const [state, setState] = useState<FinderState>("idle");
  const [zipCode, setZipCode] = useState("");
  const [nearestLocation, setNearestLocation] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHttps, setIsHttps] = useState(true);

  // Check protocol on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsHttps(window.location.protocol === "https:");
    }
  }, []);

  // Find nearest location from coordinates
  const findNearest = useCallback(
    (userLat: number, userLng: number) => {
      const validLocations = locations.filter(
        (loc) => loc.latitude != null && loc.longitude != null
      );

      if (validLocations.length === 0) {
        setError("No locations available");
        setState("error");
        return;
      }

      let nearest: Location | null = null;
      let minDistance = Infinity;

      for (const loc of validLocations) {
        const d = calculateDistance(
          userLat,
          userLng,
          loc.latitude!,
          loc.longitude!
        );
        if (d < minDistance) {
          minDistance = d;
          nearest = loc;
        }
      }

      if (nearest) {
        setNearestLocation(nearest);
        setDistance(Math.round(minDistance * 10) / 10);
        setState("found");
      } else {
        setError("Could not determine nearest location");
        setState("error");
      }
    },
    [locations]
  );

  // Handle geolocation
  const handleGetLocation = useCallback(() => {
    setState("requesting_location");
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setState("entering_zip");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState("calculating");
        findNearest(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        // Fallback to zip code on error
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Enter your zip code instead.");
        } else {
          setError("Could not get location. Enter your zip code instead.");
        }
        setState("entering_zip");
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [findNearest]);

  // Handle zip code submit
  const handleZipSubmit = useCallback(() => {
    const cleanZip = zipCode.replace(/\D/g, "").slice(0, 5);
    if (cleanZip.length !== 5) {
      setError("Please enter a valid 5-digit zip code");
      return;
    }

    setState("calculating");
    setError(null);

    const coords = OC_ZIP_COORDS[cleanZip];
    if (coords) {
      findNearest(coords.lat, coords.lng);
    } else {
      // If zip not in our lookup, just show error
      setError("Zip code not found in our service area. Please select a location above.");
      setState("error");
    }
  }, [zipCode, findNearest]);

  // Handle booking the nearest location
  const handleBookNearest = useCallback(() => {
    if (!nearestLocation) return;
    resetBooking();
    setLocation(nearestLocation.id, nearestLocation.name, nearestLocation.slug);
    router.push(`/book/${nearestLocation.slug}`);
  }, [nearestLocation, resetBooking, setLocation, router]);

  // Reset to idle
  const handleReset = () => {
    setState("idle");
    setNearestLocation(null);
    setDistance(null);
    setError(null);
    setZipCode("");
  };

  // Idle state - show prompt
  if (state === "idle") {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#8B687A]/10 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-[#8B687A]" />
              </div>
              <span className="text-sm text-slate-700">Find nearest location</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={isHttps ? handleGetLocation : () => setState("entering_zip")}
              className="h-8 text-xs"
            >
              {isHttps ? "Use My Location" : "Enter Zip Code"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Requesting location state
  if (state === "requesting_location" || state === "calculating") {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#8B687A]" />
            <span className="text-sm text-slate-600">
              {state === "requesting_location"
                ? "Getting your location..."
                : "Finding nearest location..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Entering zip code state
  if (state === "entering_zip") {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          {error && (
            <p className="text-xs text-amber-600 mb-2">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter zip code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="h-9 text-sm flex-1"
              maxLength={5}
            />
            <Button
              size="sm"
              onClick={handleZipSubmit}
              disabled={zipCode.length !== 5}
              className="h-9 bg-[#8B687A] hover:bg-[#6d5261]"
            >
              Find
            </Button>
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Found state
  if (state === "found" && nearestLocation) {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {nearestLocation.city}
                </p>
                <p className="text-xs text-slate-500">
                  {distance} miles away
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                onClick={handleBookNearest}
                className="h-8 text-xs bg-[#8B687A] hover:bg-[#6d5261]"
              >
                Book Here
              </Button>
              <button
                onClick={handleReset}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className={cn("px-4 py-3", className)}>
        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
