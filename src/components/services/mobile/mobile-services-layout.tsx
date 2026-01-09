"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MobileServiceCard } from "./mobile-service-card";
import { MobileServiceDetailSheet } from "./mobile-service-detail-sheet";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  isActive: boolean;
  isVariablePrice: boolean;
  imageUrl: string | null;
  locationIds: string[];
}

interface Location {
  id: string;
  name: string;
  city: string;
}

// Normalize category name for display (remove underscores, title case)
function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Priority order for lash categories (first in list = first in display)
const PRIORITY_CATEGORIES = [
  "LASH_EXTENSIONS",
  "LASH_FILLS",
  "LASH_LIFTS",
];

// Sort categories with lash categories first, then alphabetical
function sortCategories(categories: string[]): string[] {
  return categories.sort((a, b) => {
    const aIndex = PRIORITY_CATEGORIES.indexOf(a);
    const bIndex = PRIORITY_CATEGORIES.indexOf(b);

    // Both are priority categories - sort by priority order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only a is priority
    if (aIndex !== -1) return -1;
    // Only b is priority
    if (bIndex !== -1) return 1;
    // Neither - alphabetical
    return a.localeCompare(b);
  });
}

// Group services by category
function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce((acc, service) => {
    const category = service.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);
}

export function MobileServicesLayout() {
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services?includeInactive=true&includeLocations=true");
      const data = await response.json();
      if (data.services) {
        setServices(data.services);
        // Update selected service if it exists
        if (selectedService) {
          const updated = data.services.find((s: Service) => s.id === selectedService.id);
          setSelectedService(updated || null);
        }
      }
    } catch {
      toast.error("Failed to load services");
    }
  }, [selectedService?.id]);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/locations");
      const data = await response.json();
      if (data.locations) {
        setLocations(data.locations);
      }
    } catch {
      toast.error("Failed to load locations");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchServices(), fetchLocations()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setIsDetailOpen(true);
  };

  const handleUpdateService = async (updates: Partial<Service>) => {
    if (!selectedService) return;

    // Optimistic update
    const updatedService = { ...selectedService, ...updates };
    setSelectedService(updatedService);
    setServices((prev) =>
      prev.map((s) => (s.id === selectedService.id ? updatedService : s))
    );

    try {
      const response = await fetch(`/api/services/${selectedService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update");
    } catch {
      await fetchServices();
      throw new Error("Failed to update");
    }
  };

  const handleDeleteService = async () => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/services/${selectedService.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setSelectedService(null);
      await fetchServices();
    } catch {
      throw new Error("Failed to delete");
    }
  };

  const handleLocationToggle = async (locationId: string, enabled: boolean) => {
    if (!selectedService) return;

    const newLocationIds = enabled
      ? [...selectedService.locationIds, locationId]
      : selectedService.locationIds.filter((id) => id !== locationId);

    // Optimistic update
    setSelectedService((prev) =>
      prev ? { ...prev, locationIds: newLocationIds } : null
    );
    setServices((prev) =>
      prev.map((s) =>
        s.id === selectedService.id ? { ...s, locationIds: newLocationIds } : s
      )
    );

    try {
      const response = await fetch(`/api/services/${selectedService.id}/locations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds: newLocationIds }),
      });

      if (!response.ok) throw new Error("Failed to update");
    } catch {
      await fetchServices();
      throw new Error("Failed to update");
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  // Filter and group services
  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupedServices = groupByCategory(filteredServices);
  const categories = sortCategories(Object.keys(groupedServices));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between h-14 px-4">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services..."
                  className="pl-9 h-10"
                  autoFocus
                />
              </div>
              <button
                onClick={clearSearch}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Services</h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Search className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Service List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p>No services found</p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-2 text-blue-600 text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white">
            {categories.map((category) => {
              const categoryServices = groupedServices[category];
              const isCollapsed = collapsedCategories.has(category);

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 active:bg-gray-100"
                  >
                    <span className="text-sm font-semibold text-gray-700">
                      {formatCategoryName(category)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {categoryServices.length}
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Services in Category */}
                  {!isCollapsed && (
                    <div>
                      {categoryServices.map((service) => (
                        <MobileServiceCard
                          key={service.id}
                          service={service}
                          onClick={() => handleServiceClick(service)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom padding for nav */}
        <div className="h-20" />
      </div>

      {/* Service Detail Sheet */}
      <MobileServiceDetailSheet
        service={selectedService}
        locations={locations}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdate={handleUpdateService}
        onDelete={handleDeleteService}
        onLocationToggle={handleLocationToggle}
      />
    </div>
  );
}
