"use client";

import { useState } from "react";
import { ChevronRight, Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES, getCategoryLabel } from "@/lib/service-categories";

interface BaseService {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  isVariablePrice: boolean;
  imageUrl: string | null;
}

interface ServiceListProps<T extends BaseService> {
  services: T[];
  selectedId: string | null;
  onSelect: (service: T) => void;
}

export function ServiceList<T extends BaseService>({ services, selectedId, onSelect }: ServiceListProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(SERVICE_CATEGORIES.map((c) => c.value))
  );

  // Filter services by search
  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group services by category
  const servicesByCategory = SERVICE_CATEGORIES.map((category) => ({
    ...category,
    services: filteredServices.filter((s) => s.category === category.value),
  })).filter((group) => group.services.length > 0);

  const toggleCategory = (categoryValue: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryValue)) {
        next.delete(categoryValue);
      } else {
        next.add(categoryValue);
      }
      return next;
    });
  };

  const formatPrice = (service: BaseService) => {
    if (service.isVariablePrice) {
      return "Variable";
    }
    return `$${service.price}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Service List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {servicesByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mb-2" />
              <span className="text-sm">No services found</span>
            </div>
          ) : (
            servicesByCategory.map((group) => (
              <Collapsible
                key={group.value}
                open={expandedCategories.has(group.value)}
                onOpenChange={() => toggleCategory(group.value)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/50 transition-colors text-left">
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      expandedCategories.has(group.value) && "rotate-90"
                    )}
                  />
                  <span className="font-medium text-sm truncate">
                    {group.label}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {group.services.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 pl-2 border-l space-y-0.5">
                    {group.services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => onSelect(service)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-md text-left transition-all duration-150",
                          "hover:bg-muted/70",
                          selectedId === service.id
                            ? "bg-primary/10 border-l-2 border-primary -ml-[2px] pl-[10px]"
                            : "",
                          !service.isActive && "opacity-50"
                        )}
                      >
                        {/* Thumbnail */}
                        <div className={cn(
                          "w-8 h-8 rounded shrink-0 bg-muted flex items-center justify-center overflow-hidden",
                          selectedId === service.id && "ring-2 ring-primary/50"
                        )}>
                          {service.imageUrl ? (
                            <img
                              src={service.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Service Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-sm truncate",
                              selectedId === service.id ? "font-semibold" : "font-medium"
                            )}>
                              {service.name}
                            </span>
                            {!service.isActive && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Off
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDuration(service.durationMinutes)}</span>
                            <span>•</span>
                            <span className={service.isVariablePrice ? "text-amber-600" : ""}>
                              {formatPrice(service)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Stats footer */}
      <div className="p-3 border-t bg-muted/30 shrink-0">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{services.length} services</span>
          <span>{services.filter((s) => s.isActive).length} active</span>
        </div>
      </div>
    </div>
  );
}
