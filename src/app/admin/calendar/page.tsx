"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { ResourceCalendar } from "@/components/calendar/resource-calendar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/calendar/appointment-details-dialog";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";
import { StaffScheduleDialog } from "@/components/calendar/staff-schedule-dialog";
import { PersonalEventDialog } from "@/components/calendar/personal-event-dialog";
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

interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

// localStorage keys for persisting calendar state
const STORAGE_KEYS = {
  locationId: "bloom_calendar_locationId",
  date: "bloom_calendar_date",
};

function CalendarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appointmentIdFromUrl = searchParams.get("apt");

  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<TechnicianBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<TechnicianBlock | null>(null);
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

  // Update URL when appointment is selected/deselected
  const updateAppointmentUrl = useCallback((appointmentId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (appointmentId) {
      params.set("apt", appointmentId);
    } else {
      params.delete("apt");
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch technician blocks when location or date changes
  const fetchBlocks = useCallback(async () => {
    if (!selectedLocationId) return;

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Fetch all blocks for the selected date
      const response = await fetch(
        `/api/technician-blocks?startDate=${dateStr}&endDate=${dateStr}`
      );
      const data = await response.json();
      if (data.blocks) {
        setBlocks(
          data.blocks.map((block: Record<string, unknown>) => ({
            id: block.id,
            technicianId: block.technicianId,
            title: block.title,
            blockType: block.blockType,
            startTime: new Date(block.startTime as string),
            endTime: new Date(block.endTime as string),
            isActive: block.isActive,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch technician blocks:", error);
    }
  }, [selectedLocationId, selectedDate]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Combined refresh function for after creating events
  const refreshCalendarData = useCallback(() => {
    fetchAppointments();
    fetchBlocks();
  }, [fetchAppointments, fetchBlocks]);

  // Fetch a specific appointment by ID (for deep linking)
  const fetchAppointmentById = useCallback(async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.appointment) {
          const apt = data.appointment;
          setSelectedAppointment({
            id: apt.id,
            startTime: new Date(apt.startTime),
            endTime: new Date(apt.endTime),
            clientName: `${apt.client?.firstName || ""} ${apt.client?.lastName || ""}`,
            serviceName: apt.service?.name || "",
            technicianId: apt.technicianId,
            status: apt.status,
            notes: apt.notes,
            noShowProtected: apt.noShowProtected,
            noShowFeeCharged: apt.noShowFeeCharged,
            noShowFeeAmount: apt.noShowFeeAmount,
            noShowChargedAt: apt.noShowChargedAt ? new Date(apt.noShowChargedAt) : undefined,
            createdAt: apt.createdAt ? new Date(apt.createdAt) : undefined,
            bookedBy: apt.bookedBy,
            client: {
              ...apt.client,
              paymentMethods: apt.client?.paymentMethods || [],
            },
            service: apt.service,
            technician: apt.technician,
            location: apt.location,
          });
        }
      } else {
        // Invalid appointment ID - clear it from URL
        updateAppointmentUrl(null);
        toast.error("Appointment not found");
      }
    } catch (error) {
      console.error("Failed to fetch appointment:", error);
      updateAppointmentUrl(null);
    }
  }, [updateAppointmentUrl]);

  // Open appointment from URL if present
  useEffect(() => {
    if (appointmentIdFromUrl && appointments.length > 0) {
      const appointmentFromUrl = appointments.find(apt => apt.id === appointmentIdFromUrl);
      if (appointmentFromUrl) {
        setSelectedAppointment(appointmentFromUrl);
      } else if (!loading) {
        // Appointment not found in current view - could be from different date/location
        // Fetch it directly
        fetchAppointmentById(appointmentIdFromUrl);
      }
    }
  }, [appointmentIdFromUrl, appointments, loading, fetchAppointmentById]);

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
    updateAppointmentUrl(appointment.id);
  };

  const handleCloseAppointment = () => {
    setSelectedAppointment(null);
    updateAppointmentUrl(null);
  };

  const handleSlotClick = (technicianId: string, time: Date) => {
    setNewAppointmentSlot({ technicianId, time });
  };

  const handleBlockClick = (block: TechnicianBlock) => {
    setSelectedBlock(block);
  };

  // Handle drag-and-drop appointment move
  const handleMoveAppointment = useCallback(
    async (
      appointmentId: string,
      newTechnicianId: string,
      newStartTime: Date,
      newEndTime: Date,
      notifyClient: boolean
    ) => {
      try {
        const response = await fetch(`/api/appointments/${appointmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: newTechnicianId,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
            notifyClient,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.code === "CONFLICT") {
            toast.error(`Cannot move: conflicts with ${error.conflict?.clientName || "another appointment"}`);
          } else {
            toast.error(error.error || "Failed to move appointment");
          }
          throw new Error(error.error || "Failed to move appointment");
        }

        toast.success(notifyClient ? "Appointment moved. Client notified." : "Appointment moved.");
        fetchAppointments();
      } catch (error) {
        console.error("Failed to move appointment:", error);
        throw error;
      }
    },
    [fetchAppointments]
  );

  // Handle drag-to-create personal event block
  const handleCreateBlock = useCallback(
    async (
      technicianId: string,
      title: string,
      startTime: Date,
      endTime: Date
    ) => {
      try {
        const response = await fetch("/api/technician-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId,
            title,
            blockType: "PERSONAL",
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          toast.error(error.error || "Failed to create event");
          throw new Error(error.error || "Failed to create event");
        }

        toast.success("Personal event created");
        fetchBlocks();
      } catch (error) {
        console.error("Failed to create block:", error);
        throw error;
      }
    },
    [fetchBlocks]
  );

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
        blocks={blocks}
        selectedLocationId={selectedLocationId}
        selectedDate={selectedDate}
        onLocationChange={handleLocationChange}
        onDateChange={handleDateChange}
        onAppointmentClick={handleAppointmentClick}
        onBlockClick={handleBlockClick}
        onSlotClick={handleSlotClick}
        onScheduleClick={() => setScheduleDialogOpen(true)}
        onMoveAppointment={handleMoveAppointment}
        onCreateBlock={handleCreateBlock}
      />

      {/* Appointment details dialog - Square style */}
      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        onClose={handleCloseAppointment}
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
            handleCloseAppointment();
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
            handleCloseAppointment();
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
            handleCloseAppointment();
            fetchAppointments();
          } catch (error) {
            console.error("Failed to charge no-show fee:", error);
            toast.error(error instanceof Error ? error.message : "Failed to charge no-show fee");
          } finally {
            setCharging(false);
          }
        }}
        onAddCard={async (clientId) => {
          // Refresh the appointment to get updated payment methods
          if (selectedAppointment) {
            await fetchAppointmentById(selectedAppointment.id);
          }
          toast.success("Card setup initiated");
        }}
        onRemoveCard={async (paymentMethodId) => {
          try {
            const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
              method: "DELETE",
            });
            if (!response.ok) throw new Error("Failed to remove card");
            toast.success("Card removed");
            // Refresh the appointment to get updated payment methods
            if (selectedAppointment) {
              await fetchAppointmentById(selectedAppointment.id);
            }
          } catch (error) {
            console.error("Failed to remove card:", error);
            toast.error("Failed to remove card");
            throw error;
          }
        }}
        onUpdateClientNotes={async (clientId, notes) => {
          try {
            const response = await fetch(`/api/clients/${clientId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes }),
            });
            if (!response.ok) throw new Error("Failed to update client notes");
            toast.success("Client notes updated");
            // Refresh the appointment to get updated client data
            if (selectedAppointment) {
              await fetchAppointmentById(selectedAppointment.id);
            }
          } catch (error) {
            console.error("Failed to update client notes:", error);
            toast.error("Failed to update client notes");
            throw error;
          }
        }}
        onNavigateToAppointment={(appointmentId) => {
          // Navigate to the appointment by fetching and displaying it
          fetchAppointmentById(appointmentId);
        }}
        saving={saving}
      />

      {/* Create event dialog (appointments + personal events) */}
      {newAppointmentSlot && (
        <CreateEventDialog
          open={!!newAppointmentSlot}
          onClose={() => setNewAppointmentSlot(null)}
          technicianId={newAppointmentSlot.technicianId}
          technicianName={`${newTech?.firstName || ""} ${newTech?.lastName || ""}`}
          technicianColor={newTech?.color || "#8B687A"}
          locationId={selectedLocationId}
          locationName={locations.find(l => l.id === selectedLocationId)?.name || ""}
          time={newAppointmentSlot.time}
          locations={locations}
          technicians={technicians}
          onSuccess={refreshCalendarData}
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

      {/* Personal event dialog */}
      <PersonalEventDialog
        block={selectedBlock}
        technicians={technicians}
        onClose={() => setSelectedBlock(null)}
        onSave={refreshCalendarData}
        onDelete={refreshCalendarData}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CalendarContent />
    </Suspense>
  );
}
