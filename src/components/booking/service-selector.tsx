"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
}

interface ServiceSelectorProps {
  locationSlug: string;
  locationId: string;
  locationName: string;
  servicesByCategory: Record<string, Service[]>;
}

// Popular services that get a badge
const POPULAR_SERVICES = ["Classic Full Set", "Volume Full Set", "Hybrid Full Set", "Lash Fill"];

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

  // Scroll active category pill into view
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
  };

  const activeServices = servicesByCategory[activeCategory] || [];

  // Handle no services at all
  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <Link href="/book">
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Badge variant="secondary" className="text-xs">{locationName}</Badge>
          </div>
        </div>
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">No Services Available</h2>
          <p className="text-sm text-muted-foreground mt-2">
            This location doesn't have any services yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please try another location or check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button and location info */}
      <div>
        <Link href="/book">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <Badge variant="secondary" className="text-xs">{locationName}</Badge>
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">Select a Service</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {categories.length === 1 ? "1 category" : `${categories.length} categories`} available
        </p>
      </div>

      {/* Horizontal Scroll Category Pills */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide -mx-4 px-4"
      >
        <div className="flex gap-2 w-max pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                "border-2",
                activeCategory === category
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              )}
            >
              {category}
              <span className="ml-1.5 text-xs opacity-70">
                ({servicesByCategory[category].length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-2">
        {activeServices.map((service) => {
          const isPopular = POPULAR_SERVICES.some((p) =>
            service.name.toLowerCase().includes(p.toLowerCase())
          );

          return (
            <Link
              key={service.id}
              href={`/book/${locationSlug}/${service.id}`}
            >
              <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md active:scale-[0.99]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{service.name}</p>
                        {isPopular && (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] flex-shrink-0">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {service.durationMinutes} min
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          ${service.depositAmount} deposit
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">${service.price}</span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {activeServices.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No services available in this category.
          </p>
        </Card>
      )}
    </div>
  );
}
