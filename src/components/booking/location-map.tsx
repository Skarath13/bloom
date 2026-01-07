"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

interface LocationMapProps {
  locations: Location[];
}

// Orange County center - adjusted to show all locations nicely
const OC_CENTER: [number, number] = [33.67, -117.85];
const DEFAULT_ZOOM = 11;

// Custom marker with modern styling
const createMarkerIcon = (isHovered: boolean = false) => {
  const size = isHovered ? 44 : 40;
  const innerSize = isHovered ? 32 : 28;

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        position: relative;
        cursor: pointer;
        transition: transform 0.2s ease;
        transform: ${isHovered ? 'scale(1.1)' : 'scale(1)'};
      ">
        <!-- Outer glow/shadow -->
        <div style="
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(139, 104, 122, 0.3) 0%, transparent 70%);
          border-radius: 50%;
          transform: scale(1.5);
        "></div>
        <!-- Main marker body -->
        <div style="
          position: absolute;
          inset: ${(size - innerSize) / 2}px;
          background: linear-gradient(135deg, #8B687A 0%, #6d5261 100%);
          border-radius: 50%;
          box-shadow:
            0 4px 12px rgba(139, 104, 122, 0.4),
            0 2px 4px rgba(0, 0, 0, 0.1),
            inset 0 1px 2px rgba(255, 255, 255, 0.2);
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <!-- Pin point -->
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 10px solid #6d5261;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2));
        "></div>
      </div>
    `,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -size],
  });
};

// Component to fit bounds to all markers
function FitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const validLocations = locations.filter(l => l.latitude && l.longitude);
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(
          validLocations.map(l => [l.latitude!, l.longitude!] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [locations, map]);

  return null;
}

export function LocationMap({ locations }: LocationMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading skeleton until client-side mount
  if (!mounted) {
    return (
      <div className="h-[500px] md:h-[600px] w-full bg-gradient-to-b from-slate-100 to-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full" />
            <p className="text-slate-400 text-sm">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter locations that have valid coordinates
  const validLocations = locations.filter(
    (loc) => loc.latitude !== null && loc.longitude !== null
  );

  return (
    <div className="relative">
      <MapContainer
        center={OC_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-[500px] md:h-[600px] w-full rounded-xl z-0"
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ background: "#f8fafc" }}
      >
        {/* CartoDB Positron - clean, minimal, modern light style */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <FitBounds locations={validLocations} />

        {validLocations.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude!, location.longitude!]}
            icon={createMarkerIcon()}
          >
            <Popup className="custom-popup">
              <div className="min-w-[220px] p-2">
                <h3 className="font-semibold text-base text-slate-900 mb-1">
                  {location.name}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {location.address}
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  {location.city}, {location.state} {location.zipCode}
                </p>
                <Link href={`/book/${location.slug}`} className="block">
                  <Button
                    size="sm"
                    className="w-full bg-[#8B687A] hover:bg-[#6d5261] text-white"
                  >
                    Select Location
                  </Button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Subtle border overlay for polish */}
      <div className="absolute inset-0 rounded-xl border border-slate-200 pointer-events-none" />
    </div>
  );
}
