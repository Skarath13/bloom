"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Calendar, MapPin, Loader2, Sparkles, Package } from "lucide-react";
import { TechnicianServices } from "@/components/admin/technicians/technician-services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Calendar colors (earth tones / pastels for professional calendar appearance)
const calendarColors = [
  { value: "#7CB342", label: "Sage Green" },
  { value: "#E07A5F", label: "Terracotta" },
  { value: "#5B8FA8", label: "Dusty Blue" },
  { value: "#9B72AA", label: "Lavender" },
  { value: "#E9967A", label: "Coral" },
  { value: "#2A9D8F", label: "Teal" },
  { value: "#C48B9F", label: "Dusty Rose" },
  { value: "#6B8E4E", label: "Olive" },
  { value: "#C9A66B", label: "Sand" },
  { value: "#6B7A8F", label: "Slate Blue" },
  { value: "#B4838D", label: "Mauve" },
  { value: "#4A7C59", label: "Forest Green" },
  { value: "#8B8589", label: "Warm Gray" },
  { value: "#BC6C49", label: "Burnt Sienna" },
  { value: "#7B8DC1", label: "Periwinkle" },
];

// Days of week
const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface Location {
  id: string;
  name: string;
  city: string;
}

interface Schedule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  description: string | null;
  color: string;
  isActive: boolean;
  hasMasterFee: boolean;
  locations: Location[];
  schedules?: Schedule[];
  updatedAt?: string; // For optimistic locking
}

const defaultSchedule: Schedule[] = daysOfWeek.map((day) => ({
  dayOfWeek: day.value,
  startTime: "09:00",
  endTime: "19:00",
  isWorking: day.value !== 0, // Off on Sunday by default
}));

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [schedule, setSchedule] = useState<Schedule[]>(defaultSchedule);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    description: "",
    locationIds: [] as string[],
    color: "#7CB342",
    isActive: true,
    hasMasterFee: false,
  });

  // Track request IDs for race condition handling
  const techFetchRequestId = useRef(0);
  const locationFetchRequestId = useRef(0);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    const requestId = ++locationFetchRequestId.current;

    try {
      const response = await fetch("/api/locations");
      const data = await response.json();

      // Only update if this is still the latest request
      if (requestId === locationFetchRequestId.current && data.locations) {
        setLocations(data.locations);
      }
    } catch (error) {
      if (requestId === locationFetchRequestId.current) {
        console.error("Error fetching locations:", error);
        toast.error("Failed to load locations");
      }
    }
  }, []);

  // Fetch technicians
  const fetchTechnicians = useCallback(async () => {
    const requestId = ++techFetchRequestId.current;

    try {
      const response = await fetch("/api/technicians?activeOnly=false");
      const data = await response.json();

      // Only update if this is still the latest request
      if (requestId === techFetchRequestId.current && data.technicians) {
        setTechnicians(data.technicians);
      }
    } catch (error) {
      if (requestId === techFetchRequestId.current) {
        console.error("Error fetching technicians:", error);
        toast.error("Failed to load technicians");
      }
    } finally {
      if (requestId === techFetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchTechnicians();
  }, [fetchLocations, fetchTechnicians]);

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      description: "",
      locationIds: [],
      color: "#7CB342",
      isActive: true,
      hasMasterFee: false,
    });
    setEditingTech(null);
  };

  const handleEdit = (tech: Technician) => {
    setEditingTech(tech);
    setFormData({
      firstName: tech.firstName,
      lastName: tech.lastName,
      description: tech.description || "",
      locationIds: tech.locations.map((l) => l.id),
      color: tech.color,
      isActive: tech.isActive,
      hasMasterFee: tech.hasMasterFee || false,
    });
    setIsDialogOpen(true);
  };

  const handleServices = (tech: Technician) => {
    setSelectedTech(tech);
    setIsServicesDialogOpen(true);
  };

  const handleSchedule = async (tech: Technician) => {
    setSelectedTech(tech);
    // Fetch schedule from API
    try {
      const response = await fetch(`/api/technicians/${tech.id}/schedule`);
      const data = await response.json();
      if (data.schedules && data.schedules.length > 0) {
        setSchedule(data.schedules);
      } else {
        setSchedule(defaultSchedule);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setSchedule(defaultSchedule);
    }
    setIsScheduleDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName) {
      toast.error("Please fill in first and last name");
      return;
    }

    if (formData.locationIds.length === 0) {
      toast.error("Please select at least one location");
      return;
    }

    setIsSaving(true);

    // Store previous state for rollback
    const previousTechnicians = [...technicians];

    try {
      if (editingTech) {
        // Optimistic update for editing
        const optimisticTech: Technician = {
          ...editingTech,
          firstName: formData.firstName,
          lastName: formData.lastName,
          description: formData.description || null,
          color: formData.color,
          isActive: formData.isActive,
          hasMasterFee: formData.hasMasterFee,
          locations: locations.filter((l) => formData.locationIds.includes(l.id)),
        };

        setTechnicians((prev) =>
          prev.map((t) => (t.id === editingTech.id ? optimisticTech : t))
        );

        // Update existing technician
        const response = await fetch(`/api/technicians/${editingTech.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            description: formData.description || null,
            color: formData.color,
            locationIds: formData.locationIds,
            isActive: formData.isActive,
            hasMasterFee: formData.hasMasterFee,
            expectedUpdatedAt: editingTech.updatedAt, // For conflict detection
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          // Rollback on error
          setTechnicians(previousTechnicians);

          if (error.conflict) {
            toast.error("This technician was modified by someone else. Please refresh and try again.");
            await fetchTechnicians();
          } else {
            throw new Error(error.error || "Failed to update technician");
          }
          return;
        }

        const data = await response.json();
        // Update with server response (includes new updatedAt)
        setTechnicians((prev) =>
          prev.map((t) => (t.id === editingTech.id ? data.technician : t))
        );

        toast.success("Technician updated successfully");
      } else {
        // Create new technician (no optimistic update for creates)
        const response = await fetch("/api/technicians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            description: formData.description || null,
            color: formData.color,
            locationIds: formData.locationIds,
            isActive: formData.isActive,
            hasMasterFee: formData.hasMasterFee,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create technician");
        }

        await fetchTechnicians();
        toast.success("Technician added successfully");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      // Rollback on error
      setTechnicians(previousTechnicians);
      console.error("Error saving technician:", error);
      toast.error("Failed to save technician");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedTech) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/technicians/${selectedTech.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: schedule }),
      });

      if (!response.ok) {
        throw new Error("Failed to save schedule");
      }

      toast.success(`Schedule saved for ${selectedTech.firstName}`);
      setIsScheduleDialogOpen(false);
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this technician?")) {
      return;
    }

    // Optimistic delete
    const previousTechnicians = [...technicians];
    setTechnicians((prev) => prev.filter((t) => t.id !== id));

    try {
      const response = await fetch(`/api/technicians/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        // Rollback on error
        setTechnicians(previousTechnicians);
        toast.error(data.error || "Failed to delete technician");
        return;
      }

      toast.success("Technician deleted");
    } catch (error) {
      // Rollback on error
      setTechnicians(previousTechnicians);
      console.error("Error deleting technician:", error);
      toast.error("Failed to delete technician");
    }
  };

  const toggleActive = async (tech: Technician) => {
    // Optimistic update
    const previousTechnicians = [...technicians];
    const newActiveState = !tech.isActive;

    setTechnicians((prev) =>
      prev.map((t) => (t.id === tech.id ? { ...t, isActive: newActiveState } : t))
    );

    try {
      const response = await fetch(`/api/technicians/${tech.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: newActiveState,
          expectedUpdatedAt: tech.updatedAt,
        }),
      });

      if (!response.ok) {
        // Rollback on error
        setTechnicians(previousTechnicians);
        const error = await response.json();
        if (error.conflict) {
          toast.error("This technician was modified by someone else. Refreshing...");
          await fetchTechnicians();
        } else {
          throw new Error("Failed to update status");
        }
        return;
      }

      const data = await response.json();
      // Update with server response
      setTechnicians((prev) =>
        prev.map((t) => (t.id === tech.id ? data.technician : t))
      );
    } catch (error) {
      // Rollback on error
      setTechnicians(previousTechnicians);
      console.error("Error toggling active:", error);
      toast.error("Failed to update status");
    }
  };

  const toggleLocationSelection = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(locationId)
        ? prev.locationIds.filter((id) => id !== locationId)
        : [...prev.locationIds, locationId],
    }));
  };

  const filteredTechnicians = selectedLocation === "all"
    ? technicians
    : technicians.filter((t) => t.locations.some((l) => l.id === selectedLocation));

  const techsByLocation = locations.map((loc) => ({
    ...loc,
    count: technicians.filter((t) => t.locations.some((l) => l.id === loc.id)).length,
  }));

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
          <h1 className="text-3xl font-bold tracking-tight">Technicians</h1>
          <p className="text-muted-foreground">
            Manage your team members and their schedules
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Technician
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Technicians</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{technicians.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {technicians.filter((t) => t.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Technicians by Location */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                View and manage technicians by location
              </CardDescription>
            </div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTechnicians.map((tech) => (
                <TableRow key={tech.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {tech.firstName} {tech.lastName}
                      {tech.hasMasterFee && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Master
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {tech.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tech.locations.map((loc) => (
                        <Badge key={loc.id} variant="outline" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {loc.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: tech.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {calendarColors.find((c) => c.value === tech.color)?.label || tech.color}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={tech.isActive}
                      onCheckedChange={() => toggleActive(tech)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleServices(tech)}
                        title="Manage Services"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSchedule(tech)}
                        title="Edit Schedule"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(tech)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tech.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTechnicians.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No technicians found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Location Summary */}
      <Card>
        <CardHeader>
          <CardTitle>By Location</CardTitle>
          <CardDescription>Technician distribution across locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {techsByLocation.map((loc) => (
              <div
                key={loc.id}
                className="p-4 border rounded-lg text-center hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedLocation(loc.id)}
              >
                <div className="font-medium">{loc.name}</div>
                <div className="text-2xl font-bold mt-1">{loc.count}</div>
                <div className="text-xs text-muted-foreground">technicians</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Technician Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (isSaving) return; // Prevent closing while saving
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTech ? "Edit Technician" : "Add New Technician"}
            </DialogTitle>
            <DialogDescription>
              {editingTech
                ? "Update the technician details below"
                : "Fill in the details to add a new team member"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  placeholder="Katie"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  placeholder="M"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Specializes in classic lashes and volume sets..."
                rows={2}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                This will be shown to clients during booking
              </p>
            </div>

            <div className="space-y-2">
              <Label>Locations *</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`loc-${loc.id}`}
                      checked={formData.locationIds.includes(loc.id)}
                      onCheckedChange={() => toggleLocationSelection(loc.id)}
                      disabled={isSaving}
                    />
                    <label
                      htmlFor={`loc-${loc.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {loc.name}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select all locations where this technician works
              </p>
            </div>

            <div className="space-y-2">
              <Label>Calendar Color</Label>
              <div className="flex items-center gap-3">
                {/* Color picker input */}
                <div className="relative">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer overflow-hidden"
                    style={{ padding: 0 }}
                    disabled={isSaving}
                  />
                </div>
                {/* Current color display */}
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium">
                    {calendarColors.find((c) => c.value.toLowerCase() === formData.color.toLowerCase())?.label || "Custom"}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {formData.color}
                  </span>
                </div>
              </div>
              {/* Preset color swatches */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {calendarColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      formData.color.toLowerCase() === color.value.toLowerCase()
                        ? "border-gray-900 ring-2 ring-gray-400"
                        : "border-gray-200"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData((prev) => ({ ...prev, color: color.value }))}
                    title={color.label}
                    disabled={isSaving}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
                disabled={isSaving}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Switch
                id="hasMasterFee"
                checked={formData.hasMasterFee}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, hasMasterFee: checked }))
                }
                disabled={isSaving}
              />
              <div>
                <Label htmlFor="hasMasterFee" className="cursor-pointer flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Master Technician
                </Label>
                <p className="text-xs text-muted-foreground">
                  +$5 fee notice displayed to clients
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTech ? "Update" : "Add"} Technician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={(open) => {
        if (isSaving) return;
        setIsScheduleDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Schedule for {selectedTech?.firstName} {selectedTech?.lastName}
            </DialogTitle>
            <DialogDescription>
              Set working hours for each day of the week
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {schedule.map((day, index) => (
              <div
                key={day.dayOfWeek}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <div className="w-28">
                  <span className="font-medium">
                    {daysOfWeek.find((d) => d.value === day.dayOfWeek)?.label}
                  </span>
                </div>
                <Switch
                  checked={day.isWorking}
                  onCheckedChange={(checked) => {
                    const newSchedule = [...schedule];
                    newSchedule[index].isWorking = checked;
                    setSchedule(newSchedule);
                  }}
                  disabled={isSaving}
                />
                {day.isWorking ? (
                  <>
                    <Input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => {
                        const newSchedule = [...schedule];
                        newSchedule[index].startTime = e.target.value;
                        setSchedule(newSchedule);
                      }}
                      className="w-32"
                      disabled={isSaving}
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => {
                        const newSchedule = [...schedule];
                        newSchedule[index].endTime = e.target.value;
                        setSchedule(newSchedule);
                      }}
                      className="w-32"
                      disabled={isSaving}
                    />
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Not working</span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Services Dialog */}
      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Services for {selectedTech?.firstName} {selectedTech?.lastName}
            </DialogTitle>
            <DialogDescription>
              Configure which services this technician can perform and set custom durations
            </DialogDescription>
          </DialogHeader>

          {selectedTech && (
            <TechnicianServices
              technicianId={selectedTech.id}
              technicianLocationIds={selectedTech.locations.map((l) => l.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
