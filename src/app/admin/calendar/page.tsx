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
  recurrenceRule?: string | null;
  instanceDate?: string;
  isRecurring?: boolean;
}

// localStorage keys for persisting calendar state
const STORAGE_KEYS = {
  locationIds: "bloom_calendar_locationIds",
  date: "bloom_calendar_date",
  multiLocationMode: "bloom_calendar_multiLocationMode",
};

function CalendarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appointmentIdFromUrl = searchParams.get("apt");
  const settingsOpenFromUrl = searchParams.get("settings") === "true";

  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<TechnicianBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<TechnicianBlock | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage (client-side only)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(STORAGE_KEYS.locationIds);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
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
  const [multiLocationMode, setMultiLocationMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.multiLocationMode) === "true";
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

  // Update URL when settings modal is opened/closed
  const handleSettingsOpenChange = useCallback((open: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set("settings", "true");
    } else {
      params.delete("settings");
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
          // Sort locations in preferred order
          const locationOrder = ["Tustin", "Costa Mesa", "Santa Ana", "Irvine", "Newport Beach"];
          const sortedLocations = [...data.locations].sort((a: Location, b: Location) => {
            const aIndex = locationOrder.indexOf(a.name);
            const bIndex = locationOrder.indexOf(b.name);
            // If not in the order list, put at the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          setLocations(sortedLocations);
          // Check if saved locations are valid, otherwise default to first
          const validIds = selectedLocationIds.filter((id: string) =>
            data.locations.some((loc: Location) => loc.id === id)
          );
          if (validIds.length === 0) {
            const defaultLocs = [data.locations[0].id];
            setSelectedLocationIds(defaultLocs);
            localStorage.setItem(STORAGE_KEYS.locationIds, JSON.stringify(defaultLocs));
          } else if (validIds.length !== selectedLocationIds.length) {
            setSelectedLocationIds(validIds);
            localStorage.setItem(STORAGE_KEYS.locationIds, JSON.stringify(validIds));
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

  // Fetch technicians when locations change
  const fetchTechnicians = useCallback(async () => {
    if (selectedLocationIds.length === 0) return;

    try {
      // Fetch technicians for all selected locations
      const allTechnicians: Technician[] = [];
      for (const locationId of selectedLocationIds) {
        const response = await fetch(`/api/technicians?locationId=${locationId}`);
        const data = await response.json();
        if (data.technicians) {
          allTechnicians.push(
            ...data.technicians.map((t: Technician & { schedules?: TechnicianSchedule[] }) => ({
              id: t.id,
              firstName: t.firstName,
              lastName: t.lastName,
              color: t.color,
              locationId: t.locationId,
              schedules: t.schedules || [],
            }))
          );
        }
      }
      setTechnicians(allTechnicians);
    } catch (error) {
      console.error("Failed to fetch technicians:", error);
      toast.error("Failed to load technicians");
    }
  }, [selectedLocationIds]);

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  // Fetch appointments when locations or date changes
  // Fetch blocks helper (no loading state - used by combined fetch)
  const fetchBlocksData = useCallback(async (dateStr: string) => {
    const response = await fetch(
      `/api/technician-blocks?startDate=${dateStr}&endDate=${dateStr}`
    );
    const data = await response.json();
    if (data.blocks) {
      return data.blocks.map((block: Record<string, unknown>) => ({
        id: block.id,
        technicianId: block.technicianId,
        title: block.title,
        blockType: block.blockType,
        startTime: new Date(block.startTime as string),
        endTime: new Date(block.endTime as string),
        isActive: block.isActive,
        recurrenceRule: block.recurrenceRule as string | null | undefined,
        instanceDate: block.instanceDate as string | undefined,
        isRecurring: block.isRecurring as boolean | undefined,
      }));
    }
    return [];
  }, []);

  // Fetch appointments helper (no loading state - used by combined fetch)
  const fetchAppointmentsData = useCallback(async (dateStr: string) => {
    const allAppointments: Appointment[] = [];
    for (const locationId of selectedLocationIds) {
      const response = await fetch(
        `/api/appointments?locationId=${locationId}&date=${dateStr}`
      );
      const data = await response.json();
      if (data.appointments) {
        allAppointments.push(
          ...data.appointments.map((apt: Record<string, unknown>) => ({
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
    }
    return allAppointments;
  }, [selectedLocationIds]);

  // Combined fetch for appointments and blocks - prevents flash/blink
  const fetchAppointments = useCallback(async () => {
    if (selectedLocationIds.length === 0) return;

    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Fetch both in parallel, wait for both to complete
      const [appointmentsData, blocksData] = await Promise.all([
        fetchAppointmentsData(dateStr),
        fetchBlocksData(dateStr),
      ]);

      // Update both states together
      setAppointments(appointmentsData);
      setBlocks(blocksData);
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [selectedLocationIds, selectedDate, fetchAppointmentsData, fetchBlocksData]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Standalone blocks fetch for refresh after block operations
  const fetchBlocks = useCallback(async () => {
    if (selectedLocationIds.length === 0) return;
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const blocksData = await fetchBlocksData(dateStr);
      setBlocks(blocksData);
    } catch (error) {
      console.error("Failed to fetch technician blocks:", error);
    }
  }, [selectedLocationIds, selectedDate, fetchBlocksData]);

  // Combined refresh function for after creating events
  const refreshCalendarData = useCallback(() => {
    fetchAppointments(); // Now fetches both appointments and blocks
  }, [fetchAppointments]);

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

  // Subscribe to realtime updates for live calendar sync (use first selected location)
  useRealtimeAppointments({
    locationId: selectedLocationIds[0] || "",
    onChange: fetchAppointments,
  });

  // Subscribe to realtime technician/schedule updates
  useRealtimeTechnicians({
    locationId: selectedLocationIds[0] || "",
    onChange: fetchTechnicians,
  });

  const handleLocationToggle = (locationId: string) => {
    let newIds: string[];
    if (multiLocationMode) {
      // Multi-select mode: toggle locations on/off
      if (selectedLocationIds.includes(locationId)) {
        // Don't allow deselecting if it's the last one
        if (selectedLocationIds.length > 1) {
          newIds = selectedLocationIds.filter((id) => id !== locationId);
        } else {
          return; // Don't deselect the last one
        }
      } else {
        newIds = [...selectedLocationIds, locationId];
      }
    } else {
      // Single-select mode (default): just select the clicked location
      newIds = [locationId];
    }
    setSelectedLocationIds(newIds);
    localStorage.setItem(STORAGE_KEYS.locationIds, JSON.stringify(newIds));
  };

  const handleMultiLocationModeChange = (enabled: boolean) => {
    setMultiLocationMode(enabled);
    localStorage.setItem(STORAGE_KEYS.multiLocationMode, String(enabled));
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
        // Format as local datetime (YYYY-MM-DDTHH:mm:ss) to avoid timezone issues
        // Using toISOString() would convert to UTC and cause date filter mismatches
        const formatLocalDateTime = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        const response = await fetch(`/api/appointments/${appointmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: newTechnicianId,
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
            notifyClient,
            skipConflictCheck: true, // Allow overlapping appointments for drag-and-drop moves
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

  // Handle drag-and-drop block (personal event) move
  const handleMoveBlock = useCallback(
    async (
      blockId: string,
      newTechnicianId: string,
      newStartTime: Date,
      newEndTime: Date
    ) => {
      try {
        // Format as local datetime (YYYY-MM-DDTHH:mm:ss) to match how blocks are stored
        // Using toISOString() would convert to UTC and cause timezone issues
        const formatLocalDateTime = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        const response = await fetch(`/api/technician-blocks/${blockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: newTechnicianId,
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          toast.error(error.error || "Failed to move personal event");
          throw new Error(error.error || "Failed to move personal event");
        }

        toast.success("Personal event moved.");
        fetchBlocks();
      } catch (error) {
        console.error("Failed to move block:", error);
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
        selectedLocationIds={selectedLocationIds}
        selectedDate={selectedDate}
        multiLocationMode={multiLocationMode}
        settingsOpen={settingsOpenFromUrl}
        onSettingsOpenChange={handleSettingsOpenChange}
        onLocationToggle={handleLocationToggle}
        onDateChange={handleDateChange}
        onAppointmentClick={handleAppointmentClick}
        onBlockClick={handleBlockClick}
        onSlotClick={handleSlotClick}
        onScheduleClick={() => setScheduleDialogOpen(true)}
        onMoveAppointment={handleMoveAppointment}
        onMoveBlock={handleMoveBlock}
        onMultiLocationModeChange={handleMultiLocationModeChange}
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
          locationId={newTech?.locationId || selectedLocationIds[0] || ""}
          locationName={locations.find(l => l.id === (newTech?.locationId || selectedLocationIds[0]))?.name || ""}
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
        selectedLocationId={selectedLocationIds[0] || ""}
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
