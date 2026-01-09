"use client";

import { useState, useCallback, useEffect } from "react";
import { MapPin, Shield, Star, CalendarCheck } from "lucide-react";
import { useBooking } from "./booking-context";
import { LocationCard } from "./location-card";
import { ReturningClientCard } from "./returning-client-card";
import { NearestLocationFinder } from "./nearest-location-finder";
import { OtpVerificationScreen } from "./otp-verification-screen";
import { ClientData } from "@/hooks/use-phone-verification";

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

interface GridLocationSelectorProps {
  locations: Location[];
}

interface OtpState {
  phone: string;
  formattedPhone: string;
}

export function GridLocationSelector({ locations }: GridLocationSelectorProps) {
  const { setLocation, resetBooking } = useBooking();

  // OTP mode state (not persisted - resets on refresh)
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [verifiedClient, setVerifiedClient] = useState<{ firstName: string; id: string } | null>(null);

  // Scroll to top when returning from OTP screen
  useEffect(() => {
    if (otpState === null) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [otpState]);

  const handleLocationClick = (location: Location) => {
    resetBooking();
    setLocation(location.id, location.name, location.slug);
  };

  // Handle when user wants to send OTP code
  const handleSendCode = useCallback((phone: string, formattedPhone: string) => {
    setOtpState({ phone, formattedPhone });
  }, []);

  // Handle going back from OTP screen
  const handleOtpBack = useCallback(() => {
    setOtpState(null);
  }, []);

  // Handle successful verification
  const handleVerified = useCallback((clientData: ClientData | null) => {
    if (clientData) {
      setVerifiedClient({ firstName: clientData.firstName, id: clientData.id });
    }
    // Stay on OTP screen - it will show the verified state with history
  }, []);

  // If in OTP mode, show full-screen OTP verification
  if (otpState) {
    return (
      <OtpVerificationScreen
        phone={otpState.phone}
        formattedPhone={otpState.formattedPhone}
        onBack={handleOtpBack}
        onVerified={handleVerified}
      />
    );
  }

  // Empty state
  if (locations.length === 0) {
    return (
      <div className="h-screen-mobile flex flex-col items-center justify-center px-4 safe-area-inset-top safe-area-inset-bottom">
        <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No locations available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Please check back later
        </p>
      </div>
    );
  }

  // Sort locations in preferred order and take first 5
  const locationOrder = ["tustin", "costa mesa", "irvine", "santa ana", "newport beach"];
  const displayLocations = [...locations]
    .sort((a, b) => {
      const aIndex = locationOrder.findIndex(name => a.name.toLowerCase().includes(name));
      const bIndex = locationOrder.findIndex(name => b.name.toLowerCase().includes(name));
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .slice(0, 5);

  return (
    <div
      className="min-h-screen-mobile flex flex-col safe-area-inset-top safe-area-inset-bottom"
      style={{
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Header with Logo and Action Cue */}
      <div className="flex-shrink-0 pt-4 pb-1 px-4">
        <div className="flex justify-center">
          <div className="w-56 h-14 overflow-hidden">
            <img
              src="/logo.webp"
              alt="Elegant Lashes by Katie"
              className="w-full h-full object-contain scale-150"
            />
          </div>
        </div>
        <h1 className="text-center text-base font-bold text-slate-800 mt-1">
          Select a location to get started
        </h1>
      </div>

      {/* 2x3 Grid */}
      <div className="flex-1 px-4 py-3">
        <div
          className="grid grid-cols-2 gap-3"
          style={{
            gridTemplateRows: "repeat(3, minmax(176px, auto))",
          }}
        >
          {/* First card: Returning Client Login */}
          <ReturningClientCard
            className="min-h-[176px]"
            onSendCode={handleSendCode}
            verifiedClient={verifiedClient}
          />

          {/* Location cards */}
          {displayLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onClick={() => handleLocationClick(location)}
            />
          ))}
        </div>
      </div>

      {/* Find Nearest Location */}
      <NearestLocationFinder locations={locations} />

      {/* Social Proof Footer */}
      <div className="flex-shrink-0 pb-4 px-4">
        {/* Trust Indicators */}
        <div className="flex justify-center gap-4 mb-2">
          <span className="flex items-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 mr-1 text-green-600" />
            Licensed
          </span>
          <span className="flex items-center text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 mr-1 text-yellow-500 fill-yellow-500" />
            Highly Rated
          </span>
          <span className="flex items-center text-xs text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5 mr-1 text-blue-500" />
            Easy Booking
          </span>
        </div>

        {/* Social Proof */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              <div className="w-5 h-5 rounded-full bg-pink-200 border-2 border-background" />
              <div className="w-5 h-5 rounded-full bg-purple-200 border-2 border-background" />
              <div className="w-5 h-5 rounded-full bg-blue-200 border-2 border-background" />
            </div>
            <span className="text-xs text-muted-foreground">
              Trusted by 7,500+ clients
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Questions? Text us at 657-334-9919
          </p>
        </div>
      </div>
    </div>
  );
}
