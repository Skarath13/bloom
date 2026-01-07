"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MapPin, Phone, Clock, Users, Loader2 } from "lucide-react";
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

// Days of week mapping
const daysOfWeek = [
  { value: 0, key: "sunday", label: "Sunday", short: "Sun" },
  { value: 1, key: "monday", label: "Monday", short: "Mon" },
  { value: 2, key: "tuesday", label: "Tuesday", short: "Tue" },
  { value: 3, key: "wednesday", label: "Wednesday", short: "Wed" },
  { value: 4, key: "thursday", label: "Thursday", short: "Thu" },
  { value: 5, key: "friday", label: "Friday", short: "Fri" },
  { value: 6, key: "saturday", label: "Saturday", short: "Sat" },
];

// Database format for operating hours
interface DBOperatingHours {
  [key: string]: {
    open: string | null;
    close: string | null;
    isOpen: boolean;
  };
}

// UI format for operating hours
interface UIOperatingHours {
  dayOfWeek: number;
  key: string;
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
  phone: string;
  isActive: boolean;
  operatingHours: DBOperatingHours;
  technicianCount?: number;
}

// Convert DB format to UI format
function dbToUIHours(dbHours: DBOperatingHours): UIOperatingHours[] {
  return daysOfWeek.map((day) => {
    const hours = dbHours[day.key] || { open: "09:00", close: "19:00", isOpen: day.value !== 0 };
    return {
      dayOfWeek: day.value,
      key: day.key,
      isOpen: hours.isOpen,
      openTime: hours.open || "09:00",
      closeTime: hours.close || "19:00",
    };
  });
}

// Convert UI format to DB format
function uiToDBHours(uiHours: UIOperatingHours[]): DBOperatingHours {
  const dbHours: DBOperatingHours = {};
  uiHours.forEach((hour) => {
    dbHours[hour.key] = {
      open: hour.isOpen ? hour.openTime : null,
      close: hour.isOpen ? hour.closeTime : null,
      isOpen: hour.isOpen,
    };
  });
  return dbHours;
}

const defaultUIHours: UIOperatingHours[] = daysOfWeek.map((day) => ({
  dayOfWeek: day.value,
  key: day.key,
  isOpen: day.value !== 0, // Closed on Sunday by default
  openTime: "09:00",
  closeTime: "19:00",
}));

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHoursDialogOpen, setIsHoursDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [operatingHours, setOperatingHours] = useState<UIOperatingHours[]>(defaultUIHours);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    address: "",
    city: "",
    state: "CA",
    zipCode: "",
    phone: "",
    isActive: true,
  });

  // Fetch locations from API
  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/locations?activeOnly=false&includeTechnicianCount=true");
      const data = await response.json();
      if (data.locations) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      address: "",
      city: "",
      state: "CA",
      zipCode: "",
      phone: "",
      isActive: true,
    });
    setEditingLocation(null);
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return digits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      slug: location.slug,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      phone: location.phone,
      isActive: location.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleHours = (location: Location) => {
    setSelectedLocation(location);
    setOperatingHours(dbToUIHours(location.operatingHours));
    setIsHoursDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      if (editingLocation) {
        // Update existing location
        const response = await fetch(`/api/locations/${editingLocation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            slug: formData.slug || generateSlug(formData.name),
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            phone: formData.phone,
            isActive: formData.isActive,
          }),
        });

        if (!response.ok) throw new Error("Failed to update location");
        toast.success("Location updated successfully");
      } else {
        // Create new location
        const response = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            slug: formData.slug || generateSlug(formData.name),
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            phone: formData.phone,
            isActive: formData.isActive,
          }),
        });

        if (!response.ok) throw new Error("Failed to create location");
        toast.success("Location added successfully");
      }

      await fetchLocations();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error(editingLocation ? "Failed to update location" : "Failed to add location");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHours = async () => {
    if (!selectedLocation) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/locations/${selectedLocation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatingHours: uiToDBHours(operatingHours),
        }),
      });

      if (!response.ok) throw new Error("Failed to update hours");

      toast.success("Operating hours saved");
      await fetchLocations();
      setIsHoursDialogOpen(false);
    } catch (error) {
      console.error("Error saving hours:", error);
      toast.error("Failed to save operating hours");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const location = locations.find((l) => l.id === id);
    if (location && (location.technicianCount || 0) > 0) {
      toast.error("Cannot delete location with assigned technicians");
      return;
    }

    if (!confirm("Are you sure you want to delete this location?")) return;

    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete location");
      }

      toast.success("Location deleted");
      await fetchLocations();
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete location");
    }
  };

  const toggleActive = async (id: string) => {
    const location = locations.find((l) => l.id === id);
    if (!location) return;

    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !location.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update location");

      await fetchLocations();
    } catch (error) {
      console.error("Error toggling location:", error);
      toast.error("Failed to update location status");
    }
  };

  const getHoursSummary = (hours: DBOperatingHours) => {
    const uiHours = dbToUIHours(hours);
    const openDays = uiHours.filter((h) => h.isOpen);
    if (openDays.length === 0) return "Closed";
    if (openDays.length === 7) return "Open daily";

    const firstOpen = openDays[0];
    const allSameHours = openDays.every(
      (h) => h.openTime === firstOpen.openTime && h.closeTime === firstOpen.closeTime
    );

    if (allSameHours) {
      return `${formatTime(firstOpen.openTime)} - ${formatTime(firstOpen.closeTime)}`;
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

  const totalTechnicians = locations.reduce((sum, l) => sum + (l.technicianCount || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.filter((l) => l.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Technicians</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTechnicians}</div>
          </CardContent>
        </Card>
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
                  onCheckedChange={() => toggleActive(location.id)}
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
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {formatPhone(location.phone)}
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
                  onClick={() => handleDelete(location.id)}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    }));
                  }}
                  placeholder="Newport Beach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="newport-beach"
                />
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="(949) 555-5555"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLocation ? "Update" : "Add"} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Operating Hours Dialog */}
      <Dialog open={isHoursDialogOpen} onOpenChange={setIsHoursDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Operating Hours - {selectedLocation?.name}
            </DialogTitle>
            <DialogDescription>
              Set the hours this location is open for appointments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {operatingHours.map((day, index) => (
              <div
                key={day.dayOfWeek}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <div className="w-24">
                  <span className="font-medium">
                    {daysOfWeek.find((d) => d.value === day.dayOfWeek)?.label}
                  </span>
                </div>
                <Switch
                  checked={day.isOpen}
                  onCheckedChange={(checked) => {
                    const newHours = [...operatingHours];
                    newHours[index].isOpen = checked;
                    setOperatingHours(newHours);
                  }}
                />
                {day.isOpen ? (
                  <>
                    <Input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => {
                        const newHours = [...operatingHours];
                        newHours[index].openTime = e.target.value;
                        setOperatingHours(newHours);
                      }}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => {
                        const newHours = [...operatingHours];
                        newHours[index].closeTime = e.target.value;
                        setOperatingHours(newHours);
                      }}
                      className="w-28"
                    />
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Closed</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last appointment slot is typically 1 hour before closing
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoursDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHours} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Hours
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
