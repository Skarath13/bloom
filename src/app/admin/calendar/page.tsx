"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ResourceCalendar } from "@/components/calendar/resource-calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, Mail, Clock, CreditCard, User, Scissors, Loader2, ShieldCheck, ShieldX, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  technicianId: string;
  status: string;
  notes?: string;
  noShowProtected?: boolean;
  noShowFeeCharged?: boolean;
  noShowFeeAmount?: number;
  noShowChargedAt?: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    phoneVerified: boolean;
    stripeCustomerId?: string;
    paymentMethods?: PaymentMethod[];
  };
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
  };
  technician?: {
    id: string;
    firstName: string;
    lastName: string;
    color: string;
  };
}

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
];

// localStorage keys for persisting calendar state
const STORAGE_KEYS = {
  locationId: "bloom_calendar_locationId",
  date: "bloom_calendar_date",
};

export default function CalendarPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage (client-side only)
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEYS.locationId) || "";
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date();
    const saved = localStorage.getItem(STORAGE_KEYS.date);
    if (saved) {
      const parsed = new Date(saved);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{
    technicianId: string;
    time: Date;
  } | null>(null);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("25");
  const [chargeReason, setChargeReason] = useState("No-show fee");
  const [charging, setCharging] = useState(false);

  // Fetch locations on mount
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch("/api/locations");
        const data = await response.json();
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
          // Check if saved location is valid, otherwise default to first
          const savedIsValid = selectedLocationId &&
            data.locations.some((loc: Location) => loc.id === selectedLocationId);
          if (!savedIsValid) {
            const defaultLoc = data.locations[0].id;
            setSelectedLocationId(defaultLoc);
            localStorage.setItem(STORAGE_KEYS.locationId, defaultLoc);
          }
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
        toast.error("Failed to load locations");
      }
    }
    fetchLocations();
  }, []);

  // Fetch technicians when location changes
  useEffect(() => {
    async function fetchTechnicians() {
      if (!selectedLocationId) return;

      try {
        const response = await fetch(`/api/technicians?locationId=${selectedLocationId}`);
        const data = await response.json();
        if (data.technicians) {
          setTechnicians(
            data.technicians.map((t: Technician) => ({
              id: t.id,
              firstName: t.firstName,
              lastName: t.lastName,
              color: t.color,
              locationId: t.locationId,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch technicians:", error);
        toast.error("Failed to load technicians");
      }
    }
    fetchTechnicians();
  }, [selectedLocationId]);

  // Fetch appointments when location or date changes
  const fetchAppointments = useCallback(async () => {
    if (!selectedLocationId) return;

    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(
        `/api/appointments?locationId=${selectedLocationId}&date=${dateStr}`
      );
      const data = await response.json();
      if (data.appointments) {
        setAppointments(
          data.appointments.map((apt: Record<string, unknown>) => ({
            id: apt.id,
            startTime: new Date(apt.startTime as string),
            endTime: new Date(apt.endTime as string),
            clientName: `${(apt.client as Record<string, string>).firstName} ${(apt.client as Record<string, string>).lastName}`,
            serviceName: (apt.service as Record<string, string>).name,
            technicianId: apt.technicianId,
            status: apt.status,
            notes: apt.notes,
            noShowProtected: apt.noShowProtected,
            noShowFeeCharged: apt.noShowFeeCharged,
            noShowFeeAmount: apt.noShowFeeAmount,
            noShowChargedAt: apt.noShowChargedAt ? new Date(apt.noShowChargedAt as string) : undefined,
            client: apt.client,
            service: apt.service,
            technician: apt.technician,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Subscribe to realtime updates for live calendar sync
  useRealtimeAppointments({
    locationId: selectedLocationId,
    onChange: fetchAppointments,
  });

  const handleLocationChange = (locationId: string) => {
    setSelectedLocationId(locationId);
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEYS.locationId, locationId);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEYS.date, date.toISOString());
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditingStatus(appointment.status);
    setEditingNotes(appointment.notes || "");
  };

  const handleSlotClick = (technicianId: string, time: Date) => {
    setNewAppointmentSlot({ technicianId, time });
  };

  const handleSaveAppointment = async () => {
    if (!selectedAppointment) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editingStatus,
          notes: editingNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update appointment");
      }

      toast.success("Appointment updated");
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error("Failed to update appointment:", error);
      toast.error("Failed to update appointment");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel appointment");
      }

      const data = await response.json();
      toast.success(
        data.refunded
          ? `Appointment cancelled. $${data.refundAmount} refunded.`
          : "Appointment cancelled."
      );
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      toast.error("Failed to cancel appointment");
    } finally {
      setSaving(false);
    }
  };

  const handleChargeNoShow = async () => {
    if (!selectedAppointment) return;

    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setCharging(true);
    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: chargeReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to charge");
      }

      toast.success(data.message);
      setChargeDialogOpen(false);
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error) {
      console.error("Failed to charge no-show fee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to charge no-show fee");
    } finally {
      setCharging(false);
    }
  };

  const selectedTech = technicians.find((t) => t.id === selectedAppointment?.technicianId);
  const newTech = technicians.find((t) => t.id === newAppointmentSlot?.technicianId);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "secondary",
      CONFIRMED: "default",
      CHECKED_IN: "default",
      IN_PROGRESS: "default",
      COMPLETED: "outline",
      CANCELLED: "destructive",
      NO_SHOW: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace("_", " ")}</Badge>;
  };

  if (loading && locations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ResourceCalendar
        locations={locations}
        technicians={technicians}
        appointments={appointments}
        selectedLocationId={selectedLocationId}
        selectedDate={selectedDate}
        onLocationChange={handleLocationChange}
        onDateChange={handleDateChange}
        onAppointmentClick={handleAppointmentClick}
        onSlotClick={handleSlotClick}
      />

      {/* Appointment details dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Appointment Details
              {selectedAppointment && getStatusBadge(selectedAppointment.status)}
            </DialogTitle>
            <DialogDescription>
              View and manage this appointment
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4" />
                  {selectedAppointment.client?.firstName} {selectedAppointment.client?.lastName}
                </div>
                {selectedAppointment.client?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {selectedAppointment.client.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                    {selectedAppointment.client.phoneVerified && (
                      <Badge variant="outline" className="text-xs">Verified</Badge>
                    )}
                  </div>
                )}
                {selectedAppointment.client?.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {selectedAppointment.client.email}
                  </div>
                )}
              </div>

              {/* Service Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Service</Label>
                  <div className="flex items-center gap-1 font-medium">
                    <Scissors className="h-3 w-3" />
                    {selectedAppointment.serviceName}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Technician</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedTech?.color }}
                    />
                    {selectedTech?.firstName} {selectedTech?.lastName}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Time</Label>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(selectedAppointment.startTime, "h:mm a")} -{" "}
                    {format(selectedAppointment.endTime, "h:mm a")}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Card on File</Label>
                  <div className="flex items-center gap-1">
                    {selectedAppointment.client?.paymentMethods?.length ? (
                      <>
                        <CreditCard className="h-3 w-3 text-green-600" />
                        <span className="text-green-600 capitalize">
                          {selectedAppointment.client.paymentMethods[0].brand} •••• {selectedAppointment.client.paymentMethods[0].last4}
                        </span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">None</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* No-show Protection Status */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedAppointment.client?.paymentMethods?.length ? (
                      <>
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">No-show Protected</span>
                      </>
                    ) : (
                      <>
                        <ShieldX className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">No Protection</span>
                      </>
                    )}
                  </div>
                  {selectedAppointment.noShowFeeCharged ? (
                    <Badge variant="destructive" className="text-xs">
                      Charged ${selectedAppointment.noShowFeeAmount}
                    </Badge>
                  ) : selectedAppointment.client?.paymentMethods?.length ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChargeDialogOpen(true)}
                      className="text-xs"
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      Charge Fee
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Status Select */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editingStatus} onValueChange={setEditingStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add notes about this appointment..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={handleCancelAppointment}
              disabled={saving || selectedAppointment?.status === "CANCELLED"}
            >
              Cancel Appointment
            </Button>
            <Button onClick={handleSaveAppointment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New appointment dialog */}
      {newAppointmentSlot && (
        <ManualBookingDialog
          open={!!newAppointmentSlot}
          onClose={() => setNewAppointmentSlot(null)}
          technicianId={newAppointmentSlot.technicianId}
          technicianName={`${newTech?.firstName || ""} ${newTech?.lastName || ""}`}
          locationId={selectedLocationId}
          time={newAppointmentSlot.time}
          onSuccess={fetchAppointments}
        />
      )}

      {/* Charge no-show fee dialog */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Charge No-Show Fee</DialogTitle>
            <DialogDescription>
              Charge {selectedAppointment?.client?.firstName} {selectedAppointment?.client?.lastName} for no-show or late cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chargeReason">Reason</Label>
              <Select value={chargeReason} onValueChange={setChargeReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No-show fee">No-show fee</SelectItem>
                  <SelectItem value="Late cancellation fee">Late cancellation fee</SelectItem>
                  <SelectItem value="Cancellation fee">Cancellation fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chargeAmount">Amount ($)</Label>
              <Input
                id="chargeAmount"
                type="number"
                min="1"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="25.00"
              />
            </div>
            {selectedAppointment?.client?.paymentMethods?.[0] && (
              <div className="text-sm text-muted-foreground">
                Card to charge:{" "}
                <span className="font-medium capitalize">
                  {selectedAppointment.client.paymentMethods[0].brand} •••• {selectedAppointment.client.paymentMethods[0].last4}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)} disabled={charging}>
              Cancel
            </Button>
            <Button onClick={handleChargeNoShow} disabled={charging}>
              {charging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Charge ${chargeAmount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
