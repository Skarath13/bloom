"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Calendar, MapPin } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Mock locations
const locations = [
  { id: "loc-1", name: "Irvine", city: "Irvine" },
  { id: "loc-2", name: "Tustin", city: "Tustin" },
  { id: "loc-3", name: "Santa Ana", city: "Santa Ana" },
  { id: "loc-4", name: "Costa Mesa", city: "Costa Mesa" },
  { id: "loc-5", name: "Newport Beach", city: "Newport Beach" },
];

// Calendar colors
const calendarColors = [
  { value: "#8B687A", label: "Dusty Rose" },
  { value: "#6B5B95", label: "Purple" },
  { value: "#88B04B", label: "Green" },
  { value: "#F7CAC9", label: "Rose Quartz" },
  { value: "#92A8D1", label: "Serenity" },
  { value: "#955251", label: "Marsala" },
  { value: "#DD4124", label: "Tangerine" },
  { value: "#009B77", label: "Emerald" },
  { value: "#B565A7", label: "Orchid" },
  { value: "#5B5EA6", label: "Royal Blue" },
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

// Mock technicians
const initialTechnicians = [
  { id: "tech-1", firstName: "Katie", lastName: "Martinez", locationId: "loc-1", color: "#8B687A", email: "katie@elegantlashes.com", phone: "9495551001", isActive: true, bufferMinutes: 15 },
  { id: "tech-2", firstName: "Sarah", lastName: "Johnson", locationId: "loc-1", color: "#6B5B95", email: "sarah@elegantlashes.com", phone: "9495551002", isActive: true, bufferMinutes: 10 },
  { id: "tech-3", firstName: "Emily", lastName: "Chen", locationId: "loc-2", color: "#88B04B", email: "emily@elegantlashes.com", phone: "9495551003", isActive: true, bufferMinutes: 15 },
  { id: "tech-4", firstName: "Jessica", lastName: "Nguyen", locationId: "loc-2", color: "#F7CAC9", email: "jessica@elegantlashes.com", phone: "9495551004", isActive: true, bufferMinutes: 10 },
  { id: "tech-5", firstName: "Ashley", lastName: "Kim", locationId: "loc-3", color: "#92A8D1", email: "ashley@elegantlashes.com", phone: "9495551005", isActive: true, bufferMinutes: 15 },
  { id: "tech-6", firstName: "Michelle", lastName: "Tran", locationId: "loc-4", color: "#955251", email: "michelle@elegantlashes.com", phone: "9495551006", isActive: true, bufferMinutes: 10 },
  { id: "tech-7", firstName: "Amanda", lastName: "Lopez", locationId: "loc-5", color: "#DD4124", email: "amanda@elegantlashes.com", phone: "9495551007", isActive: true, bufferMinutes: 15 },
];

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  locationId: string;
  color: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  bufferMinutes: number;
}

interface Schedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

const defaultSchedule: Schedule[] = daysOfWeek.map((day) => ({
  dayOfWeek: day.value,
  startTime: "09:00",
  endTime: "19:00",
  isWorking: day.value !== 0, // Off on Sunday by default
}));

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [schedule, setSchedule] = useState<Schedule[]>(defaultSchedule);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    locationId: "",
    color: "#8B687A",
    email: "",
    phone: "",
    bufferMinutes: "15",
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      locationId: "",
      color: "#8B687A",
      email: "",
      phone: "",
      bufferMinutes: "15",
      isActive: true,
    });
    setEditingTech(null);
  };

  const handleEdit = (tech: Technician) => {
    setEditingTech(tech);
    setFormData({
      firstName: tech.firstName,
      lastName: tech.lastName,
      locationId: tech.locationId,
      color: tech.color,
      email: tech.email || "",
      phone: tech.phone || "",
      bufferMinutes: tech.bufferMinutes.toString(),
      isActive: tech.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSchedule = (tech: Technician) => {
    setSelectedTech(tech);
    // In real app, fetch schedule from database
    setSchedule(defaultSchedule);
    setIsScheduleDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.firstName || !formData.lastName || !formData.locationId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingTech) {
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id === editingTech.id
            ? {
                ...t,
                firstName: formData.firstName,
                lastName: formData.lastName,
                locationId: formData.locationId,
                color: formData.color,
                email: formData.email || undefined,
                phone: formData.phone || undefined,
                bufferMinutes: parseInt(formData.bufferMinutes),
                isActive: formData.isActive,
              }
            : t
        )
      );
      toast.success("Technician updated successfully");
    } else {
      const newTech: Technician = {
        id: `tech-${Date.now()}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
        locationId: formData.locationId,
        color: formData.color,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        bufferMinutes: parseInt(formData.bufferMinutes),
        isActive: formData.isActive,
      };
      setTechnicians((prev) => [...prev, newTech]);
      toast.success("Technician added successfully");
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleSaveSchedule = () => {
    // In real app, save to database
    toast.success(`Schedule saved for ${selectedTech?.firstName}`);
    setIsScheduleDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this technician?")) {
      setTechnicians((prev) => prev.filter((t) => t.id !== id));
      toast.success("Technician deleted");
    }
  };

  const toggleActive = (id: string) => {
    setTechnicians((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t))
    );
  };

  const getLocationName = (locationId: string) => {
    return locations.find((l) => l.id === locationId)?.name || "Unknown";
  };

  const filteredTechnicians = selectedLocation === "all"
    ? technicians
    : technicians.filter((t) => t.locationId === selectedLocation);

  const techsByLocation = locations.map((loc) => ({
    ...loc,
    count: technicians.filter((t) => t.locationId === loc.id).length,
  }));

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
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Buffer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTechnicians.map((tech) => (
                <TableRow key={tech.id}>
                  <TableCell className="font-medium">
                    {tech.firstName} {tech.lastName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {getLocationName(tech.locationId)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {tech.email && <div>{tech.email}</div>}
                      {tech.phone && (
                        <div className="text-muted-foreground">
                          {tech.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                        </div>
                      )}
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
                  <TableCell>{tech.bufferMinutes} min</TableCell>
                  <TableCell>
                    <Switch
                      checked={tech.isActive}
                      onCheckedChange={() => toggleActive(tech.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
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
                  placeholder="Martinez"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select
                value={formData.locationId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, locationId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="katie@elegantlashes.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="(949) 555-1001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Calendar Color</Label>
                <Select
                  value={formData.color}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, color: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {calendarColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buffer">Buffer (min)</Label>
                <Input
                  id="buffer"
                  type="number"
                  value={formData.bufferMinutes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bufferMinutes: e.target.value }))
                  }
                  placeholder="15"
                />
              </div>
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
            <Button onClick={handleSubmit}>
              {editingTech ? "Update" : "Add"} Technician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
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
                    />
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Not working</span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
