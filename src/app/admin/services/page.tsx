"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ServiceList } from "@/components/admin/services/service-list";
import { ServiceDetailPanel, ServiceDetailEmpty } from "@/components/admin/services/service-detail-panel";
import { AddServiceSheet } from "@/components/admin/services/add-service-sheet";

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

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all services with their locations
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services?includeInactive=true&includeLocations=true");
      const data = await response.json();
      if (data.services) {
        setServices(data.services);
        // Update selected service if it exists
        if (selectedService) {
          const updated = data.services.find((s: Service) => s.id === selectedService.id);
          if (updated) {
            setSelectedService(updated);
          } else {
            setSelectedService(null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    }
  }, [selectedService?.id]);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/locations");
      const data = await response.json();
      if (data.locations) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchServices(), fetchLocations()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Handle service selection
  const handleSelectService = (service: Service) => {
    // Find the full service with locations from our state
    const fullService = services.find((s) => s.id === service.id);
    setSelectedService(fullService || service);
  };

  // Handle service update (optimistic)
  const handleUpdateService = async (updates: Partial<Service>) => {
    if (!selectedService) return;

    // Optimistic update - apply changes immediately
    const updatedService = { ...selectedService, ...updates };
    setSelectedService(updatedService);
    setServices((prev) =>
      prev.map((s) => (s.id === selectedService.id ? updatedService : s))
    );

    // Background API call
    try {
      const response = await fetch(`/api/services/${selectedService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update service");
      }
    } catch (error) {
      console.error("Error updating service:", error);
      // Revert on error
      toast.error("Failed to update");
      await fetchServices();
      throw error;
    }
  };

  // Handle service delete
  const handleDeleteService = async () => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/services/${selectedService.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete service");
      }

      setSelectedService(null);
      await fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      throw error;
    }
  };

  // Handle location toggle (optimistic)
  const handleLocationToggle = async (locationId: string, enabled: boolean) => {
    if (!selectedService) return;

    const newLocationIds = enabled
      ? [...selectedService.locationIds, locationId]
      : selectedService.locationIds.filter((id) => id !== locationId);

    // Optimistic update - apply immediately
    setSelectedService((prev) =>
      prev ? { ...prev, locationIds: newLocationIds } : null
    );
    setServices((prev) =>
      prev.map((s) =>
        s.id === selectedService.id ? { ...s, locationIds: newLocationIds } : s
      )
    );

    // Background API call
    try {
      const response = await fetch(`/api/services/${selectedService.id}/locations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds: newLocationIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to update locations");
      }
    } catch (error) {
      console.error("Error updating locations:", error);
      toast.error("Failed to update location");
      // Revert on error
      await fetchServices();
    }
  };

  // Handle new service creation
  const handleCreateService = async (serviceData: Omit<Service, "id">) => {
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceData),
      });

      if (!response.ok) {
        throw new Error("Failed to create service");
      }

      const data = await response.json();
      await fetchServices();

      // Select the newly created service
      if (data.service) {
        setSelectedService(data.service);
      }
    } catch (error) {
      console.error("Error creating service:", error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">
            Manage your salon services and pricing
          </p>
        </div>
        <AddServiceSheet
          locations={locations}
          onServiceCreated={handleCreateService}
        />
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel - Service list */}
        <div className="w-80 border-r bg-muted/30 shrink-0 overflow-hidden flex flex-col">
          <ServiceList
            services={services}
            selectedId={selectedService?.id || null}
            onSelect={handleSelectService}
          />
        </div>

        {/* Right panel - Service detail */}
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedService ? (
            <ServiceDetailPanel
              service={selectedService}
              locations={locations}
              onUpdate={handleUpdateService}
              onDelete={handleDeleteService}
              onLocationToggle={handleLocationToggle}
            />
          ) : (
            <ServiceDetailEmpty />
          )}
        </div>
      </div>
    </div>
  );
}
