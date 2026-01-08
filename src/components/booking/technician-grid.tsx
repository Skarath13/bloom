"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ChevronRight, ChevronDown, User } from "lucide-react";
import { useBooking } from "./booking-context";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  description: string | null;
  color: string;
  imageUrl?: string | null;
  badges?: string[] | null;
}

interface TechnicianGridProps {
  technicians: Technician[];
  locationSlug: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  depositAmount: number;
}

// Convert multi-word badges to single word
function simplifyBadge(badge: string): string {
  const badgeMap: Record<string, string> = {
    "mega volume": "Mega",
    "cat-eye": "Cat-Eye",
    "cat eye": "Cat-Eye",
    "full set": "Full",
    "natural look": "Natural",
    "wispy lashes": "Wispy",
    "volume lashes": "Volume",
    "classic lashes": "Classic",
    "lash lift": "Lift",
    "brow lamination": "Brows",
  };

  const lower = badge.toLowerCase().trim();
  if (badgeMap[lower]) return badgeMap[lower];

  // If it's already one word, capitalize it
  if (!badge.includes(" ")) {
    return badge.charAt(0).toUpperCase() + badge.slice(1).toLowerCase();
  }

  // For unknown multi-word badges, take first word
  return badge.split(" ")[0].charAt(0).toUpperCase() + badge.split(" ")[0].slice(1).toLowerCase();
}

interface TechnicianCardProps {
  tech: Technician;
  locationSlug: string;
  serviceId: string;
  onSelect: () => void;
}

function TechnicianCard({ tech, locationSlug, serviceId, onSelect }: TechnicianCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDescription = tech.description && tech.description.length > 0;

  const handleExpandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm hover:shadow-md hover:border-[#8B687A]/40 transition-all duration-200 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {/* Main clickable area - navigates to booking */}
        <Link
          href={`/book/${locationSlug}/${serviceId}/${tech.id}`}
          onClick={onSelect}
          className="flex items-center gap-3 flex-1 min-w-0 min-h-[44px] touch-manipulation"
        >
          {/* Technician photo placeholder */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FDF2F2] to-[#EDCAC9] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
            {tech.imageUrl ? (
              <img
                src={tech.imageUrl}
                alt={`${tech.firstName} ${tech.lastName[0]}.`}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-[#8B687A]/50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[15px] text-gray-900">
              {tech.firstName}
            </p>
            {tech.badges && tech.badges.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {tech.badges.slice(0, 3).map((badge) => (
                  <span
                    key={badge}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-[#8B687A]"
                  >
                    {simplifyBadge(badge)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* Expand button - only show if has description */}
        {hasDescription ? (
          <button
            onClick={handleExpandClick}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 touch-manipulation flex-shrink-0 ${
              expanded
                ? "bg-[#8B687A] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-[#8B687A]/10 hover:text-[#8B687A]"
            }`}
            aria-label={`${expanded ? "Hide" : "Show"} info about ${tech.firstName}`}
          >
            <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>

      {/* Expandable description panel - uses CSS Grid for GPU-accelerated animation */}
      {hasDescription && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{
            gridTemplateRows: expanded ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            <div
              className="px-4 pb-3 pt-2.5 border-t border-gray-100"
              style={{
                opacity: expanded ? 1 : 0,
                transition: "opacity 150ms ease-out",
                transitionDelay: expanded ? "50ms" : "0ms",
              }}
            >
              <p className="text-[13px] text-gray-600 leading-relaxed">
                {tech.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TechnicianGrid({
  technicians,
  locationSlug,
  serviceId,
  serviceName,
  servicePrice,
  serviceDuration,
  depositAmount,
}: TechnicianGridProps) {
  const { setService, setTechnician } = useBooking();

  const handleTechnicianClick = (tech: Technician | null, isAny: boolean) => {
    // Save service info when selecting technician
    setService(serviceId, serviceName, servicePrice, serviceDuration, depositAmount);
    setTechnician(tech?.id || null, tech ? `${tech.firstName} ${tech.lastName[0]}` : null, isAny);
  };

  // Empty state - no technicians at all
  if (technicians.length === 0) {
    return (
      <div className="py-8 text-center">
        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-sm">No Technicians Available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Please try a different service or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Any Available Option - Always first, never randomized */}
      <Link
        href={`/book/${locationSlug}/${serviceId}/any`}
        onClick={() => handleTechnicianClick(null, true)}
        className="block min-h-[44px] touch-manipulation"
      >
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200/80 shadow-sm hover:shadow-md hover:border-[#8B687A]/40 transition-all duration-200 active:scale-[0.98] active:shadow-sm">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#FDF2F2] to-[#EDCAC9] flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users className="h-5 w-5 text-[#8B687A]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-[15px] text-gray-900">Any Available</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                Recommended
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Fastest Booking · First Available
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </div>
        </div>
      </Link>

      {/* Divider - only show if there's more than 1 technician */}
      {technicians.length > 1 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">or choose</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Technician List - Compact cards (randomized on server) */}
      <div className="space-y-2.5">
        {technicians.map((tech) => (
          <TechnicianCard
            key={tech.id}
            tech={tech}
            locationSlug={locationSlug}
            serviceId={serviceId}
            onSelect={() => handleTechnicianClick(tech, false)}
          />
        ))}
      </div>
    </div>
  );
}
