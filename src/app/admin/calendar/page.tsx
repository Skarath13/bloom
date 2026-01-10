"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { ResourceCalendar } from "@/components/calendar/resource-calendar";
import { CalendarConfigProvider, useCalendarConfig } from "@/components/calendar/calendar-config";
import { MobileCalendarLayout } from "@/components/calendar/mobile";
import { MobileAppointmentDetailSheet } from "@/components/calendar/mobile/mobile-appointment-detail-sheet";
import { MobileCreateAppointmentSheet } from "@/components/calendar/mobile/mobile-create-appointment-sheet";
import { MobileCreatePersonalEventSheet } from "@/components/calendar/mobile/mobile-create-personal-event-sheet";
import { MobileEventTypeSheet } from "@/components/calendar/mobile/mobile-event-type-sheet";
import { MobilePersonalEventDetailSheet } from "@/components/calendar/mobile/mobile-personal-event-detail-sheet";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/calendar/appointment-details-dialog";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";
import { StaffScheduleDialog } from "@/components/calendar/staff-schedule-dialog";
import { PersonalEventDialog } from "@/components/calendar/personal-event-dialog";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";
import { useRealtimeTechnicians } from "@/hooks/use-realtime-technicians";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AdminSidebar } from "@/components/admin/sidebar";

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
  isNewClient?: boolean;
  bookedAnyAvailable?: boolean;
  hasEarlierAppointment?: boolean;
  hasLaterAppointment?: boolean;
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
  const isMobile = useIsMobile();

  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<TechnicianBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<TechnicianBlock | null>(null);
  const [loading, setLoading] = useState(true);

  // Mobile-specific sheet states for create flows
  const [mobileCreateAppointment, setMobileCreateAppointment] = useState<{
    open: boolean;
    technicianId: string;
    technicianName: string;
    technicianColor: string;
    locationId: string;
    locationName: string;
    time: Date;
    preloadedClient?: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
    } | null;
  } | null>(null);
  const [mobileCreatePersonalEvent, setMobileCreatePersonalEvent] = useState<{
    open: boolean;
    technicianId: string;
    technicianName: string;
    locationId: string;
    time: Date;
  } | null>(null);
  // Mobile event type selection sheet (shown on slot tap)
  const [mobileEventTypeSheet, setMobileEventTypeSheet] = useState<{
    open: boolean;
    technicianId: string;
    technicianName: string;
    technicianColor: string;
    locationId: string;
    locationName: string;
    time: Date;
  } | null>(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Mobile-specific state: track which technicians are visible (for mobile filter)
  const [mobileTechFilter, setMobileTechFilter] = useState<string[]>([]);

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

  // Initialize/reset mobile tech filter when technicians change
  // This handles both initial load AND location changes
  useEffect(() => {
    if (technicians.length > 0) {
      const techIds = technicians.map(t => t.id);
      // Check if current filter has any valid IDs for these technicians
      const hasValidFilter = mobileTechFilter.some(id => techIds.includes(id));
      if (!hasValidFilter) {
        // No valid filter IDs - reset to show all technicians
        setMobileTechFilter(techIds);
      }
    }
  }, [technicians, mobileTechFilter]);

  // Handler to toggle technician visibility in mobile view
  const handleMobileTechToggle = useCallback((techId: string) => {
    setMobileTechFilter(prev => {
      if (prev.includes(techId)) {
        // Don't allow deselecting the last one
        if (prev.length > 1) {
          return prev.filter(id => id !== techId);
        }
        return prev;
      }
      return [...prev, techId];
    });
  }, []);

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
            isNewClient: apt.isNewClient as boolean | undefined,
            bookedAnyAvailable: apt.bookedAnyAvailable as boolean | undefined,
            hasEarlierAppointment: apt.hasEarlierAppointment as boolean | undefined,
            hasLaterAppointment: apt.hasLaterAppointment as boolean | undefined,
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
            isNewClient: apt.isNewClient,
            bookedAnyAvailable: apt.bookedAnyAvailable,
            hasEarlierAppointment: apt.hasEarlierAppointment,
            hasLaterAppointment: apt.hasLaterAppointment,
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
    if (isMobile) {
      // On mobile, show event type selection sheet first
      const tech = technicians.find(t => t.id === technicianId);
      if (!tech) return;
      const location = locations.find(l => l.id === tech.locationId);
      setMobileEventTypeSheet({
        open: true,
        technicianId,
        technicianName: `${tech.firstName} ${tech.lastName}`,
        technicianColor: tech.color,
        locationId: tech.locationId,
        locationName: location?.name || "",
        time,
      });
    } else {
      // On desktop, use the desktop dialog
      setNewAppointmentSlot({ technicianId, time });
    }
  };

  // Handle event type selection from mobile sheet
  const handleMobileEventTypeSelect = (type: "appointment" | "personal_event") => {
    if (!mobileEventTypeSheet) return;

    // Close the selection sheet
    setMobileEventTypeSheet(null);

    if (type === "appointment") {
      setMobileCreateAppointment({
        open: true,
        technicianId: mobileEventTypeSheet.technicianId,
        technicianName: mobileEventTypeSheet.technicianName,
        technicianColor: mobileEventTypeSheet.technicianColor,
        locationId: mobileEventTypeSheet.locationId,
        locationName: mobileEventTypeSheet.locationName,
        time: mobileEventTypeSheet.time,
      });
    } else {
      setMobileCreatePersonalEvent({
        open: true,
        technicianId: mobileEventTypeSheet.technicianId,
        technicianName: mobileEventTypeSheet.technicianName,
        locationId: mobileEventTypeSheet.locationId,
        time: mobileEventTypeSheet.time,
      });
    }
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

  // Handler for mobile create menu - opens mobile-specific create sheets
  const handleMobileCreateEvent = useCallback((type: "appointment" | "class" | "personal_event") => {
    if (type === "class") {
      // Classes not implemented yet
      toast.info("Class creation coming soon");
      return;
    }
    // Get the first visible technician for the slot
    const visibleTechs = technicians.filter(t => mobileTechFilter.includes(t.id));
    const firstTech = visibleTechs[0];
    if (!firstTech) {
      toast.error("No technician available");
      return;
    }

    // Set a slot at 9am on the selected date
    const slotTime = new Date(selectedDate);
    slotTime.setHours(9, 0, 0, 0);

    const techName = `${firstTech.firstName} ${firstTech.lastName}`;
    const location = locations.find(l => l.id === firstTech.locationId);

    if (type === "appointment") {
      setMobileCreateAppointment({
        open: true,
        technicianId: firstTech.id,
        technicianName: techName,
        technicianColor: firstTech.color,
        locationId: firstTech.locationId,
        locationName: location?.name || "",
        time: slotTime,
      });
    } else if (type === "personal_event") {
      setMobileCreatePersonalEvent({
        open: true,
        technicianId: firstTech.id,
        technicianName: techName,
        locationId: firstTech.locationId,
        time: slotTime,
      });
    }
  }, [technicians, mobileTechFilter, selectedDate, locations]);

  // Filter technicians for mobile view
  const visibleTechnicians = isMobile
    ? technicians.filter(t => mobileTechFilter.includes(t.id))
    : technicians;

  if (loading && locations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Common calendar props
  const calendarProps = {
    locations,
    technicians: visibleTechnicians,
    appointments,
    blocks,
    selectedLocationIds,
    selectedDate,
    multiLocationMode,
    settingsOpen: settingsOpenFromUrl,
    onSettingsOpenChange: handleSettingsOpenChange,
    onLocationToggle: handleLocationToggle,
    onDateChange: handleDateChange,
    onAppointmentClick: handleAppointmentClick,
    onBlockClick: handleBlockClick,
    onSlotClick: handleSlotClick,
    onScheduleClick: () => setScheduleDialogOpen(true),
    onMenuClick: () => setMobileMenuOpen(true),
    onMoveAppointment: handleMoveAppointment,
    onMoveBlock: handleMoveBlock,
    onMultiLocationModeChange: handleMultiLocationModeChange,
  };

  return (
    <CalendarConfigProvider>
      <div className="h-full">
        {isMobile ? (
          // Mobile layout with new PWA-style UI
          <MobileCalendarLayout
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            technicians={technicians}
            selectedTechIds={mobileTechFilter}
            onTechToggle={handleMobileTechToggle}
            locations={locations}
            selectedLocationId={selectedLocationIds[0] || ""}
            onLocationChange={(locationId) => {
              // Single-select for mobile
              setSelectedLocationIds([locationId]);
              localStorage.setItem(STORAGE_KEYS.locationIds, JSON.stringify([locationId]));
            }}
            onEditScheduleClick={() => setScheduleDialogOpen(true)}
            onCreateEvent={handleMobileCreateEvent}
          >
            <ResourceCalendar
              {...calendarProps}
              // On mobile, hide the built-in header since MobileCalendarLayout provides it
              hideHeader
            />
          </MobileCalendarLayout>
        ) : (
          // Desktop layout - unchanged
          <ResourceCalendar {...calendarProps} />
        )}

      {/* Appointment details - Mobile sheet or Desktop dialog */}
      {isMobile ? (
        <MobileAppointmentDetailSheet
          appointmentId={selectedAppointment?.id || null}
          open={!!selectedAppointment}
          onOpenChange={(open) => {
            if (!open) handleCloseAppointment();
          }}
          onBookNext={(client) => {
            // Close the details sheet and open create with preloaded client
            handleCloseAppointment();
            // Use the appointment's technician/location/current time for the new booking
            if (selectedAppointment?.technician && selectedAppointment?.location) {
              setMobileCreateAppointment({
                open: true,
                technicianId: selectedAppointment.technician.id,
                technicianName: `${selectedAppointment.technician.firstName} ${selectedAppointment.technician.lastName}`,
                technicianColor: selectedAppointment.technician.color,
                locationId: selectedAppointment.location.id,
                locationName: selectedAppointment.location.name,
                time: new Date(), // Use current time as starting point
                preloadedClient: client,
              });
            }
          }}
          onStatusChange={() => {
            fetchAppointments();
          }}
        />
      ) : (
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
      )}

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

      {/* Personal event dialog - Desktop only */}
      {!isMobile && (
        <PersonalEventDialog
          block={selectedBlock}
          technicians={technicians}
          onClose={() => setSelectedBlock(null)}
          onSave={refreshCalendarData}
          onDelete={refreshCalendarData}
        />
      )}

      {/* Mobile Personal Event Detail Sheet */}
      {isMobile && (
        <MobilePersonalEventDetailSheet
          block={selectedBlock}
          technician={technicians.find(t => t.id === selectedBlock?.technicianId)}
          open={!!selectedBlock}
          onOpenChange={(open) => {
            if (!open) setSelectedBlock(null);
          }}
          onSave={() => {
            refreshCalendarData();
            setSelectedBlock(null);
          }}
          onDelete={() => {
            refreshCalendarData();
            setSelectedBlock(null);
          }}
        />
      )}

      {/* Mobile Event Type Selection Sheet */}
      {mobileEventTypeSheet && (
        <MobileEventTypeSheet
          open={mobileEventTypeSheet.open}
          onOpenChange={(open) => {
            if (!open) setMobileEventTypeSheet(null);
          }}
          technicianName={mobileEventTypeSheet.technicianName}
          time={mobileEventTypeSheet.time}
          onSelect={handleMobileEventTypeSelect}
        />
      )}

      {/* Mobile Create Appointment Sheet */}
      {mobileCreateAppointment && (
        <MobileCreateAppointmentSheet
          open={mobileCreateAppointment.open}
          onOpenChange={(open) => {
            if (!open) setMobileCreateAppointment(null);
          }}
          technicianId={mobileCreateAppointment.technicianId}
          technicianName={mobileCreateAppointment.technicianName}
          technicianColor={mobileCreateAppointment.technicianColor}
          locationId={mobileCreateAppointment.locationId}
          locationName={mobileCreateAppointment.locationName}
          time={mobileCreateAppointment.time}
          onSuccess={() => {
            refreshCalendarData();
            setMobileCreateAppointment(null);
          }}
          preloadedClient={mobileCreateAppointment.preloadedClient}
        />
      )}

      {/* Mobile Create Personal Event Sheet */}
      {mobileCreatePersonalEvent && (
        <MobileCreatePersonalEventSheet
          open={mobileCreatePersonalEvent.open}
          onOpenChange={(open) => {
            if (!open) setMobileCreatePersonalEvent(null);
          }}
          technicianId={mobileCreatePersonalEvent.technicianId}
          technicianName={mobileCreatePersonalEvent.technicianName}
          locationId={mobileCreatePersonalEvent.locationId}
          time={mobileCreatePersonalEvent.time}
          onSuccess={() => {
            refreshCalendarData();
            setMobileCreatePersonalEvent(null);
          }}
        />
      )}

      {/* Mobile navigation sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-56">
          <VisuallyHidden>
            <SheetTitle>Navigation Menu</SheetTitle>
          </VisuallyHidden>
          <AdminSidebar />
        </SheetContent>
      </Sheet>
      </div>
    </CalendarConfigProvider>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CalendarContent />
    </Suspense>
  );
}
