"use client";

import Link from "next/link";
import { Users, ChevronRight, User } from "lucide-react";
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
    <div className="space-y-2">
      {/* Any Available Option - Always first, never randomized */}
      <Link
        href={`/book/${locationSlug}/${serviceId}/any`}
        onClick={() => handleTechnicianClick(null, true)}
        className="block"
      >
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-[#1E1B4B]/5 to-[#1E1B4B]/10 border border-[#1E1B4B]/20 hover:border-[#1E1B4B]/40 transition-all active:scale-[0.99]">
          <div className="h-11 w-11 rounded-full bg-[#1E1B4B] flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-gray-900">Any Available</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                Recommended
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Fastest Booking · First Available
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </Link>

      {/* Divider - only show if there's more than 1 technician */}
      {technicians.length > 1 && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">or choose</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Technician List - Compact cards (randomized on server) */}
      <div className="space-y-1.5">
        {technicians.map((tech) => (
          <Link
            key={tech.id}
            href={`/book/${locationSlug}/${serviceId}/${tech.id}`}
            onClick={() => handleTechnicianClick(tech, false)}
            className="block"
          >
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-gray-100 hover:border-[#8B687A]/30 hover:shadow-sm transition-all active:scale-[0.99]">
              {/* Technician photo placeholder */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FDF2F2] to-[#EDCAC9] flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-sm text-gray-900">
                    {tech.firstName} {tech.lastName[0]}
                  </p>
                  {tech.badges?.slice(0, 3).map((badge) => (
                    <span
                      key={badge}
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-[#8B687A] capitalize"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {tech.description || "Licensed Lash Technician"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
