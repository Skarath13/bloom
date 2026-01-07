"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fisherYatesShuffle } from "@/lib/utils";
import { useBooking } from "./booking-context";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  description: string | null;
  color: string;
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

  // Randomize technicians on every page load using Fisher-Yates
  // useMemo ensures same order during the session until refresh
  const randomizedTechnicians = useMemo(() => {
    return fisherYatesShuffle(technicians);
  }, [technicians]);

  const handleTechnicianClick = (tech: Technician | null, isAny: boolean) => {
    // Save service info when selecting technician
    setService(serviceId, serviceName, servicePrice, serviceDuration, depositAmount);
    setTechnician(tech?.id || null, tech ? `${tech.firstName} ${tech.lastName[0]}.` : null, isAny);
  };

  // Empty state - no technicians at all
  if (technicians.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium text-foreground">No Technicians Available</p>
          <p className="text-sm text-muted-foreground mt-2">
            There are no technicians available at this location for the selected service.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please try a different service or check back later.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Any Available Option - Always first, never randomized */}
      <Link
        href={`/book/${locationSlug}/${serviceId}/any`}
        onClick={() => handleTechnicianClick(null, true)}
      >
        <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="flex items-center p-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="font-semibold text-sm">Any Available</p>
              <p className="text-xs text-muted-foreground">
                Fastest booking - first available tech
              </p>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] ml-2">
              Recommended
            </Badge>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-2" />
          </CardContent>
        </Card>
      </Link>

      {/* Divider - only show if there's more than 1 technician */}
      {technicians.length > 1 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or choose your favorite</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Randomized Technician List - Single column on mobile */}
      <div className="grid gap-3 md:grid-cols-2">
        {randomizedTechnicians.map((tech) => (
          <Link
            key={tech.id}
            href={`/book/${locationSlug}/${serviceId}/${tech.id}`}
            onClick={() => handleTechnicianClick(tech, false)}
          >
            <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary active:scale-[0.98]">
              <CardContent className="flex items-center p-4">
                <Avatar
                  className="h-11 w-11 flex-shrink-0"
                  style={{ backgroundColor: tech.color }}
                >
                  <AvatarFallback className="text-white font-medium text-sm">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {tech.firstName} {tech.lastName[0]}.
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tech.description || "Lash Specialist"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">5.0</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-2" />
                    <span className="text-[10px] text-green-600">Available</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
