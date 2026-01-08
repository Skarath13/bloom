"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ChevronRight, Sparkles, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBooking } from "./booking-context";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  imageUrl?: string | null;
}

interface ServiceSelectorProps {
  locationSlug: string;
  locationId: string;
  locationName: string;
  servicesByCategory: Record<string, Service[]>;
}

// Popular services that get a badge
const POPULAR_SERVICES = ["Classic Full Set", "Volume Full Set", "Hybrid Full Set", "Lash Fill"];

// Format category name: LASH_EXTENSION -> Lash Extension
function formatCategoryName(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function ServiceSelector({
  locationSlug,
  locationId,
  locationName,
  servicesByCategory,
}: ServiceSelectorProps) {
  const categories = Object.keys(servicesByCategory);
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { setLocation } = useBooking();

  // Save location to context on mount
  useEffect(() => {
    setLocation(locationId, locationName, locationSlug);
  }, [locationId, locationName, locationSlug, setLocation]);

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
  };

  const activeServices = servicesByCategory[activeCategory] || [];

  // Handle no services at all
  if (categories.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/book">
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Select a Service</h1>
            <p className="text-xs text-muted-foreground">{locationName}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-base font-semibold">No Services Available</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This location doesn't have any services yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact header with back button and title inline */}
      <div className="flex items-center gap-3">
        <Link href="/book">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold leading-tight">Select a Service</h1>
      </div>

      {/* Horizontal Scroll Category Pills - more compact */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide -mx-4 px-4"
      >
        <div className="flex gap-1.5 w-max py-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeCategory === category
                  ? "bg-[#1E1B4B] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {formatCategoryName(category)}
              <span className="ml-1 opacity-70">
                ({servicesByCategory[category].length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Services List - compact cards with image placeholder */}
      <div className="space-y-2">
        {activeServices.map((service) => {
          const isPopular = POPULAR_SERVICES.some((p) =>
            service.name.toLowerCase().includes(p.toLowerCase())
          );

          return (
            <Link
              key={service.id}
              href={`/book/${locationSlug}/${service.id}`}
              className="block"
            >
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-gray-100 hover:border-[#8B687A]/30 hover:shadow-sm transition-all active:scale-[0.99]">
                {/* Service image placeholder */}
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#FDF2F2] to-[#EDCAC9] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-[#8B687A]/40" />
                  )}
                </div>

                {/* Service info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm text-gray-900 truncate">{service.name}</p>
                        {isPopular && (
                          <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {service.durationMinutes}min
                        </span>
                      </div>
                    </div>

                    {/* Price - more prominent */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-base font-bold text-[#1E1B4B]">${service.price}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {activeServices.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No services in this category.
          </p>
        </div>
      )}
    </div>
  );
}
