"use client";

import { useState, useEffect } from "react";
import { Clock, Loader2, Package, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCategoryLabel } from "@/lib/service-categories";

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  isActive: boolean;
}

interface ServiceTechnicianSetting {
  serviceId: string;
  isEnabled: boolean;
  customDurationMinutes: number | null;
}

interface TechnicianServicesProps {
  technicianId: string;
  technicianLocationIds: string[];
  onClose?: () => void;
}

export function TechnicianServices({
  technicianId,
  technicianLocationIds,
}: TechnicianServicesProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Map<string, ServiceTechnicianSetting>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch services available at technician's locations
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all active services
        const servicesRes = await fetch("/api/services?includeInactive=false&includeLocations=true");
        const servicesData = await servicesRes.json();

        // Filter to services available at technician's locations
        const availableServices = (servicesData.services || []).filter(
          (s: Service & { locationIds: string[] }) =>
            s.locationIds?.some((lid: string) => technicianLocationIds.includes(lid))
        );
        setServices(availableServices);

        // Fetch technician's service settings
        const settingsRes = await fetch(`/api/technicians/${technicianId}/services`);
        const settingsData = await settingsRes.json();

        const settingsMap = new Map<string, ServiceTechnicianSetting>();
        (settingsData.services || []).forEach((s: ServiceTechnicianSetting) => {
          settingsMap.set(s.serviceId, s);
        });
        setSettings(settingsMap);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load services");
      } finally {
        setIsLoading(false);
      }
    };

    if (technicianId && technicianLocationIds.length > 0) {
      fetchData();
    }
  }, [technicianId, technicianLocationIds]);

  const handleToggle = (serviceId: string, enabled: boolean) => {
    const current = settings.get(serviceId) || {
      serviceId,
      isEnabled: false,
      customDurationMinutes: null,
    };

    const updated = { ...current, isEnabled: enabled };
    const newSettings = new Map(settings);
    newSettings.set(serviceId, updated);
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleDurationChange = (serviceId: string, duration: string) => {
    const current = settings.get(serviceId) || {
      serviceId,
      isEnabled: true,
      customDurationMinutes: null,
    };

    const numDuration = parseInt(duration) || null;
    const updated = { ...current, customDurationMinutes: numDuration };
    const newSettings = new Map(settings);
    newSettings.set(serviceId, updated);
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleResetDuration = (serviceId: string) => {
    const current = settings.get(serviceId);
    if (current) {
      const updated = { ...current, customDurationMinutes: null };
      const newSettings = new Map(settings);
      newSettings.set(serviceId, updated);
      setSettings(newSettings);
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const servicesArray = Array.from(settings.values());

      const response = await fetch(`/api/technicians/${technicianId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: servicesArray }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Service settings saved");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save service settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce(
    (acc, service) => {
      const category = service.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="h-8 w-8 mb-2" />
        <p className="text-sm">No services available at assigned locations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure which services this technician can perform and set custom durations
        </p>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {getCategoryLabel(category)}
              </h4>
              <div className="space-y-2">
                {categoryServices.map((service) => {
                  const setting = settings.get(service.id);
                  const isEnabled = setting?.isEnabled ?? false;
                  const customDuration = setting?.customDurationMinutes;
                  const hasCustomDuration = customDuration !== null && customDuration !== undefined;

                  return (
                    <div
                      key={service.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border transition-all",
                        isEnabled ? "bg-white dark:bg-background" : "bg-muted/30 opacity-60"
                      )}
                    >
                      {/* Service name and toggle */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToggle(service.id, checked)}
                        />
                        <div className="min-w-0">
                          <span className="font-medium text-sm block truncate">
                            {service.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Default: {service.durationMinutes} min
                          </span>
                        </div>
                      </div>

                      {/* Custom duration input */}
                      {isEnabled && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={hasCustomDuration ? customDuration : ""}
                            onChange={(e) => handleDurationChange(service.id, e.target.value)}
                            placeholder={service.durationMinutes.toString()}
                            className="w-20 h-8 text-center"
                            min={15}
                            step={15}
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                          {hasCustomDuration && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleResetDuration(service.id)}
                              title="Reset to default"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          {hasCustomDuration && (
                            <Badge variant="secondary" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Separator className="mt-4" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
