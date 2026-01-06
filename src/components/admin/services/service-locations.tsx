"use client";

import { MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  city: string;
}

interface ServiceLocationsProps {
  locations: Location[];
  enabledLocationIds: string[];
  onToggle: (locationId: string, enabled: boolean) => void;
  disabled?: boolean;
}

export function ServiceLocations({
  locations,
  enabledLocationIds,
  onToggle,
  disabled = false,
}: ServiceLocationsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Location Availability</CardTitle>
        <CardDescription>
          Toggle which locations offer this service
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((location) => {
            const isEnabled = enabledLocationIds.includes(location.id);
            return (
              <div
                key={location.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
                  isEnabled
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                    : "bg-muted/30 border-muted hover:bg-muted/50",
                  disabled && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className={cn(
                    "h-4 w-4 shrink-0",
                    isEnabled ? "text-green-600" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0">
                    <span className={cn(
                      "font-medium text-sm block truncate",
                      isEnabled ? "text-green-900 dark:text-green-100" : "text-muted-foreground"
                    )}>
                      {location.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {location.city}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => onToggle(location.id, checked)}
                  disabled={disabled}
                  className="shrink-0 ml-2"
                />
              </div>
            );
          })}
        </div>
        {locations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No locations available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
