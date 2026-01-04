"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ResourceCalendar } from "@/components/calendar/resource-calendar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/calendar/appointment-details-dialog";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
import { StaffScheduleDialog } from "@/components/calendar/staff-schedule-dialog";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";
import { useRealtimeTechnicians } from "@/hooks/use-realtime-technicians";

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface TechnicianSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId: string;
  schedules?: TechnicianSchedule[];
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
  createdAt?: Date;
  bookedBy?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    phoneVerified: boolean;
    stripeCustomerId?: string;
    paymentMethods?: PaymentMethod[];
    notes?: string;
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
  location?: {
    id: string;
    name: string;
    city?: string;
  };
}

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
  const [saving, setSaving] = useState(false);
  const [charging, setCharging] = useState(false);
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{
    technicianId: string;
    time: Date;
  } | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

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
  const fetchTechnicians = useCallback(async () => {
    if (!selectedLocationId) return;

    try {
      const response = await fetch(`/api/technicians?locationId=${selectedLocationId}`);
      const data = await response.json();
      if (data.technicians) {
        setTechnicians(
          data.technicians.map((t: Technician & { schedules?: TechnicianSchedule[] }) => ({
            id: t.id,
            firstName: t.firstName,
            lastName: t.lastName,
            color: t.color,
            locationId: t.locationId,
            schedules: t.schedules || [],
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch technicians:", error);
      toast.error("Failed to load technicians");
    }
  }, [selectedLocationId]);

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

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
            clientName: `${(apt.client as Record<string, string>)?.firstName || ""} ${(apt.client as Record<string, string>)?.lastName || ""}`,
            serviceName: (apt.service as Record<string, string>)?.name || "",
            technicianId: apt.technicianId,
            status: apt.status,
            notes: apt.notes,
            noShowProtected: apt.noShowProtected,
            noShowFeeCharged: apt.noShowFeeCharged,
            noShowFeeAmount: apt.noShowFeeAmount,
            noShowChargedAt: apt.noShowChargedAt ? new Date(apt.noShowChargedAt as string) : undefined,
            createdAt: apt.createdAt ? new Date(apt.createdAt as string) : undefined,
            bookedBy: apt.bookedBy as string | undefined,
            client: apt.client,
            service: apt.service,
            technician: apt.technician,
            location: apt.location,
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

  // Subscribe to realtime technician/schedule updates
  useRealtimeTechnicians({
    locationId: selectedLocationId,
    onChange: fetchTechnicians,
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
  };

  const handleSlotClick = (technicianId: string, time: Date) => {
    setNewAppointmentSlot({ technicianId, time });
  };

  const newTech = technicians.find((t) => t.id === newAppointmentSlot?.technicianId);

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
        onScheduleClick={() => setScheduleDialogOpen(true)}
      />

      {/* Appointment details dialog - Square style */}
      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onSave={async (data) => {
          if (!selectedAppointment) return;
          setSaving(true);
          try {
            const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Failed to update appointment");
            toast.success("Appointment updated");
            setSelectedAppointment(null);
            fetchAppointments();
          } catch (error) {
            console.error("Failed to update appointment:", error);
            toast.error("Failed to update appointment");
          } finally {
            setSaving(false);
          }
        }}
        onCancel={async () => {
          if (!selectedAppointment) return;
          if (!confirm("Are you sure you want to cancel this appointment?")) return;
          setSaving(true);
          try {
            const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
              method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to cancel appointment");
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
        }}
        onChargeNoShow={async (amount, reason) => {
          if (!selectedAppointment) return;
          setCharging(true);
          try {
            const response = await fetch(`/api/appointments/${selectedAppointment.id}/charge`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount, reason }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to charge");
            toast.success(data.message);
            setSelectedAppointment(null);
            fetchAppointments();
          } catch (error) {
            console.error("Failed to charge no-show fee:", error);
            toast.error(error instanceof Error ? error.message : "Failed to charge no-show fee");
          } finally {
            setCharging(false);
          }
        }}
        saving={saving}
      />

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

      {/* Staff schedule dialog */}
      <StaffScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        technicians={technicians}
        locations={locations}
        selectedLocationId={selectedLocationId}
        selectedDate={selectedDate}
      />
    </div>
  );
}
