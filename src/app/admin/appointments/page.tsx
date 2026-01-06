"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Clock,
  User,
  MapPin,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  client: Client | null;
  service: Service | null;
  technician: Technician | null;
  location: Location | null;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
  { value: "PENDING", label: "Pending" },
];

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 0 }), [weekStart]);

  // Fetch locations and technicians for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [locRes, techRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/technicians"),
        ]);

        if (locRes.ok) {
          const locData = await locRes.json();
          setLocations(locData.locations || []);
        }

        if (techRes.ok) {
          const techData = await techRes.json();
          setTechnicians(techData.technicians || []);
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error);
      }
    };

    fetchFilters();
  }, []);

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("startDate", format(weekStart, "yyyy-MM-dd"));
        params.set("endDate", format(weekEnd, "yyyy-MM-dd"));

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (locationFilter !== "all") {
          params.set("locationId", locationFilter);
        }
        if (technicianFilter !== "all") {
          params.set("technicianId", technicianFilter);
        }

        const response = await fetch(`/api/appointments?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setAppointments(data.appointments || []);
        }
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, [weekStart, weekEnd, statusFilter, locationFilter, technicianFilter]);

  // Filter by search query (client-side)
  const filteredAppointments = appointments.filter((apt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const clientName = `${apt.client?.firstName || ""} ${apt.client?.lastName || ""}`.toLowerCase();
    const serviceName = apt.service?.name?.toLowerCase() || "";
    const techName = `${apt.technician?.firstName || ""} ${apt.technician?.lastName || ""}`.toLowerCase();
    return (
      clientName.includes(query) ||
      serviceName.includes(query) ||
      techName.includes(query) ||
      apt.client?.phone?.includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Confirmed</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary">Cancelled</Badge>;
      case "NO_SHOW":
        return <Badge variant="destructive">No Show</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleViewInCalendar = (apt: Appointment) => {
    const date = format(new Date(apt.startTime), "yyyy-MM-dd");
    router.push(`/admin/calendar?date=${date}&appointmentId=${apt.id}`);
  };

  // Stats
  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
    cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
    noShow: appointments.filter((a) => a.status === "NO_SHOW").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">
            View and manage all appointments
          </p>
        </div>
        <Button onClick={() => router.push("/admin/calendar")}>
          <Calendar className="h-4 w-4 mr-2" />
          Open Calendar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">No Shows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.noShow}</div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search client, service, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Location" />
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

            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="w-[150px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Technician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.firstName} {tech.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No appointments found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((apt) => (
                    <TableRow
                      key={apt.id}
                      className={
                        apt.status === "CANCELLED" || apt.status === "NO_SHOW"
                          ? "opacity-60"
                          : ""
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(apt.startTime), "EEE, MMM d")}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(apt.startTime), "h:mm a")} -{" "}
                              {format(new Date(apt.endTime), "h:mm a")}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {apt.client ? (
                          <div>
                            <div className="font-medium">
                              {apt.client.firstName} {apt.client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatPhone(apt.client.phone)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {apt.service ? (
                          <div>
                            <div className="font-medium">{apt.service.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {apt.service.durationMinutes} min · ${apt.service.price}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {apt.technician ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: apt.technician.color }}
                            />
                            <span>
                              {apt.technician.firstName} {apt.technician.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {apt.location ? (
                          <span>{apt.location.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInCalendar(apt)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
