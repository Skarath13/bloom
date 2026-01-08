"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, MapPin, Clock, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ConfirmationModal, InfoModal } from "@/components/ui/confirmation-modal";
import { HoursEditingModal } from "@/components/admin/hours-editing-modal";
import { supabase } from "@/lib/supabase";

// Database operating hours format
interface DbOperatingHours {
  [day: string]: {
    open: string | null;
    close: string | null;
    isOpen?: boolean;
  };
}

// Frontend operating hours format (for the modal)
interface OperatingHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  timezone: string;
  operatingHours: DbOperatingHours;
  isActive: boolean;
  sortOrder: number;
  technicianCount: number;
}

const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Convert DB format to frontend format
function dbHoursToFrontend(dbHours: DbOperatingHours): OperatingHours[] {
  return dayNames.map((dayName, index) => {
    const day = dbHours[dayName] || { open: "09:00", close: "19:00", isOpen: true };
    return {
      dayOfWeek: index,
      isOpen: day.isOpen !== false && day.open !== null,
      openTime: day.open || "09:00",
      closeTime: day.close || "19:00",
    };
  });
}

// Convert frontend format to DB format
function frontendHoursToDb(hours: OperatingHours[]): DbOperatingHours {
  const result: DbOperatingHours = {};
  hours.forEach((h) => {
    const dayName = dayNames[h.dayOfWeek];
    result[dayName] = {
      open: h.isOpen ? h.openTime : null,
      close: h.isOpen ? h.closeTime : null,
      isOpen: h.isOpen,
    };
  });
  return result;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    type: "deactivate" | "delete" | "cannotDelete" | null;
    location: Location | null;
  }>({ type: null, location: null });

  // Hours modal state
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);

  // Loading states
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "CA",
    zipCode: "",
  });

  // Fetch locations from Supabase
  const fetchLocations = async () => {
    try {
      const { data: locationsData, error: locationsError } = await supabase
        .from("bloom_locations")
        .select("*")
        .order("sortOrder", { ascending: true });

      if (locationsError) throw locationsError;

      // Get technician counts
      const { data: techCounts, error: techError } = await supabase
        .from("bloom_technicians")
        .select("locationId");

      if (techError) throw techError;

      // Count technicians per location
      const countMap: Record<string, number> = {};
      techCounts?.forEach((t) => {
        countMap[t.locationId] = (countMap[t.locationId] || 0) + 1;
      });

      const locationsWithCounts = (locationsData || []).map((loc) => ({
        ...loc,
        technicianCount: countMap[loc.id] || 0,
      }));

      setLocations(locationsWithCounts);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "CA",
      zipCode: "",
    });
    setEditingLocation(null);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
    });
    setIsDialogOpen(true);
  };

  const handleHours = (location: Location) => {
    setSelectedLocation(location);
    setIsHoursModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from("bloom_locations")
          .update({
            name: formData.name,
            slug: generateSlug(formData.name),
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", editingLocation.id);

        if (error) throw error;
        toast.success("Location updated");
      } else {
        const defaultHours: DbOperatingHours = {};
        dayNames.forEach((day) => {
          defaultHours[day] = { open: "09:00", close: "19:00", isOpen: true };
        });

        const { error } = await supabase.from("bloom_locations").insert({
          id: `loc-${Date.now()}`,
          name: formData.name,
          slug: generateSlug(formData.name),
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          phone: "",
          timezone: "America/Los_Angeles",
          operatingHours: defaultHours,
          isActive: true,
          sortOrder: locations.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (error) throw error;
        toast.success("Location added");
      }

      await fetchLocations();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async (hours: OperatingHours[]) => {
    if (!selectedLocation) return;

    setSavingHours(true);
    try {
      const dbHours = frontendHoursToDb(hours);

      const { error } = await supabase
        .from("bloom_locations")
        .update({
          operatingHours: dbHours,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", selectedLocation.id);

      if (error) throw error;

      await fetchLocations();
      toast.success("Operating hours saved");
      setIsHoursModalOpen(false);
    } catch (error) {
      console.error("Error saving hours:", error);
      toast.error("Failed to save hours");
    } finally {
      setSavingHours(false);
    }
  };

  const handleDelete = (location: Location) => {
    if (location.technicianCount > 0) {
      setConfirmModal({ type: "cannotDelete", location });
    } else {
      setConfirmModal({ type: "delete", location });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.location) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("bloom_locations")
        .delete()
        .eq("id", confirmModal.location.id);

      if (error) throw error;

      await fetchLocations();
      toast.success("Location deleted");
      setConfirmModal({ type: null, location: null });
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("Failed to delete location");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = (location: Location) => {
    if (location.isActive) {
      setConfirmModal({ type: "deactivate", location });
    } else {
      performToggle(location.id);
    }
  };

  const performToggle = async (id: string) => {
    const location = locations.find((l) => l.id === id);
    if (!location) return;

    setToggling(id);
    try {
      const { error } = await supabase
        .from("bloom_locations")
        .update({
          isActive: !location.isActive,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await fetchLocations();
      toast.success(location.isActive ? `${location.name} deactivated` : `${location.name} activated`);
    } catch (error) {
      console.error("Error toggling location:", error);
      toast.error("Failed to update location");
    } finally {
      setToggling(null);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmModal.location) return;
    await performToggle(confirmModal.location.id);
    setConfirmModal({ type: null, location: null });
  };

  const getHoursSummary = (hours: DbOperatingHours) => {
    const openDays = dayNames.filter((day) => {
      const h = hours[day];
      return h && h.isOpen !== false && h.open;
    });

    if (openDays.length === 0) return "Closed";
    if (openDays.length === 7) return "Open daily";

    const firstDay = hours[openDays[0]];
    const allSameHours = openDays.every((day) => {
      const h = hours[day];
      return h?.open === firstDay?.open && h?.close === firstDay?.close;
    });

    if (allSameHours && firstDay?.open && firstDay?.close) {
      return `${formatTime(firstDay.open)} - ${formatTime(firstDay.close)}`;
    }
    return "Varies by day";
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">
            Manage your salon locations and operating hours
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Location Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card key={location.id} className={!location.isActive ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {location.name}
                    {!location.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {location.city}, {location.state}
                  </CardDescription>
                </div>
                <Switch
                  checked={location.isActive}
                  onCheckedChange={() => handleToggleActive(location)}
                  disabled={toggling === location.id}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    {location.address}
                    <br />
                    {location.city}, {location.state} {location.zipCode}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {getHoursSummary(location.operatingHours)}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {location.technicianCount || 0} technicians
                </div>
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHours(location)}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Hours
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(location)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(location)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No locations found. Add your first location to get started.
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Location Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Add New Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the location details below"
                : "Fill in the details for the new location"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Newport Beach"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="359 San Miguel Dr #107"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="Newport Beach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, state: e.target.value }))
                  }
                  placeholder="CA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, zipCode: e.target.value }))
                  }
                  placeholder="92660"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLocation ? "Update" : "Add"} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hours Editing Modal */}
      {selectedLocation && (
        <HoursEditingModal
          open={isHoursModalOpen}
          onClose={() => setIsHoursModalOpen(false)}
          onSave={handleSaveHours}
          locationName={selectedLocation.name}
          initialHours={dbHoursToFrontend(selectedLocation.operatingHours)}
          saving={savingHours}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmationModal
        open={confirmModal.type === "deactivate"}
        onClose={() => setConfirmModal({ type: null, location: null })}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate Location"
        description={
          <>
            Are you sure you want to deactivate{" "}
            <span className="font-medium">&ldquo;{confirmModal.location?.name}&rdquo;</span>?
            <p className="mt-2 text-sm">
              This location has {confirmModal.location?.technicianCount || 0} technicians.
              They will not appear on the booking calendar.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              You can reactivate this location at any time.
            </p>
          </>
        }
        confirmLabel="Deactivate"
        variant="warning"
        loading={toggling === confirmModal.location?.id}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={confirmModal.type === "delete"}
        onClose={() => setConfirmModal({ type: null, location: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Location"
        description={
          <>
            Are you sure you want to permanently delete{" "}
            <span className="font-medium">&ldquo;{confirmModal.location?.name}&rdquo;</span>?
            <p className="mt-2 text-sm text-gray-500">
              This action cannot be undone.
            </p>
          </>
        }
        confirmLabel="Delete Location"
        variant="danger"
        loading={deleting}
      />

      {/* Cannot Delete Info Modal */}
      <InfoModal
        open={confirmModal.type === "cannotDelete"}
        onClose={() => setConfirmModal({ type: null, location: null })}
        title="Cannot Delete Location"
        description={
          <>
            <span className="font-medium">&ldquo;{confirmModal.location?.name}&rdquo;</span> cannot be
            deleted because it has {confirmModal.location?.technicianCount} technicians
            assigned.
            <p className="mt-2 text-sm">
              Please reassign these technicians to another location before deleting.
            </p>
          </>
        }
        variant="warning"
      />
    </div>
  );
}
