"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, ChevronRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

interface MobileServicePickerProps {
  locationId: string;
  selectedServices: Service[];
  onServicesChange: (services: Service[]) => void;
}

// Priority order for categories
const PRIORITY_CATEGORIES = ["LASH_EXTENSIONS", "LASH_FILLS", "LASH_LIFTS"];

function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortCategories(categories: string[]): string[] {
  return categories.sort((a, b) => {
    const aIndex = PRIORITY_CATEGORIES.indexOf(a);
    const bIndex = PRIORITY_CATEGORIES.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function MobileServicePicker({
  locationId,
  selectedServices,
  onServicesChange,
}: MobileServicePickerProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchServices();
  }, [locationId]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/services?locationId=${locationId}&includeLocations=true`);
      if (res.ok) {
        const data = await res.json();
        // Filter to only active services
        setServices((data.services || []).filter((s: Service & { isActive?: boolean }) => s.isActive !== false));
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setIsLoading(false);
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

  const toggleService = (service: Service) => {
    const isSelected = selectedServices.some((s) => s.id === service.id);
    if (isSelected) {
      onServicesChange(selectedServices.filter((s) => s.id !== service.id));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some((s) => s.id === serviceId);
  };

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || "OTHER";
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const categories = sortCategories(Object.keys(groupedServices));

  // Calculate totals
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Service List */}
      <div className="bg-white rounded-xl overflow-hidden">
        {categories.map((category) => {
          const categoryServices = groupedServices[category];
          const isCollapsed = collapsedCategories.has(category);
          const selectedCount = categoryServices.filter((s) => isServiceSelected(s.id)).length;

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
                  {selectedCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {selectedCount} selected
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{categoryServices.length}</span>
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
                  {categoryServices.map((service) => {
                    const selected = isServiceSelected(service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleService(service)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 transition-colors",
                          selected ? "bg-blue-50" : "active:bg-gray-50"
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                            selected
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                          )}
                        >
                          {selected && <Check className="h-4 w-4 text-white" />}
                        </div>

                        {/* Service Info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium text-gray-900">{service.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(service.durationMinutes)}
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold">${service.price}</div>
                          {service.depositAmount > 0 && (
                            <div className="text-xs text-gray-500">
                              ${service.depositAmount} deposit
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Summary */}
      {selectedServices.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
            <span>{selectedServices.length} service{selectedServices.length > 1 ? "s" : ""}</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
          <div className="flex justify-between items-center font-semibold text-lg">
            <span>Total</span>
            <span>${totalPrice}</span>
          </div>
        </div>
      )}
    </div>
  );
}
