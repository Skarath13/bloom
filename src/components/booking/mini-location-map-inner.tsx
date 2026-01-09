"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MiniLocationMapInnerProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function MiniLocationMapInner({
  latitude,
  longitude,
  className = "",
}: MiniLocationMapInnerProps) {
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setL(leaflet);
      setMounted(true);
    });
  }, []);

  // Create marker icon only after Leaflet is loaded
  const markerIcon = useMemo(() => {
    if (!L) return null;

    const size = 28;
    const innerSize = 20;

    return L.divIcon({
      className: "mini-marker",
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          position: relative;
        ">
          <div style="
            position: absolute;
            inset: ${(size - innerSize) / 2}px;
            background: linear-gradient(135deg, #8B687A 0%, #6d5261 100%);
            border-radius: 50%;
            box-shadow:
              0 2px 6px rgba(139, 104, 122, 0.4),
              0 1px 2px rgba(0, 0, 0, 0.1);
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="none">
              <circle cx="12" cy="10" r="4"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 7px solid #6d5261;
          "></div>
        </div>
      `,
      iconSize: [size, size + 7],
      iconAnchor: [size / 2, size + 4],
    });
  }, [L]);

  if (!mounted || !markerIcon) {
    return <div className="w-full h-full bg-slate-100" />;
  }

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      className={className}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      boxZoom={false}
      attributionControl={false}
      style={{ background: "#f8fafc", height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <Marker
        position={[latitude, longitude]}
        icon={markerIcon}
        interactive={false}
      />
    </MapContainer>
  );
}
