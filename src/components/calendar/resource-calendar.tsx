"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { addDays, subDays, startOfDay, setHours, setMinutes, addMinutes, isSameDay, format } from "date-fns";
import { Sparkles, Users } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { MiniCalendar } from "./mini-calendar";
import { CalendarHeader } from "./calendar-header";
import { AppointmentCard } from "./appointment-card";
import { BlockCard } from "./block-card";
import {
  calculateUnifiedOverlapPositions,
  appointmentToCalendarEvent,
  blockToCalendarEvent,
  type CalendarEvent,
  type OverlapPosition,
} from "./overlap-utils";
import { TimeIndicator } from "./time-indicator";
import { MoveConfirmationModal } from "./move-confirmation-modal";
import { CalendarSettingsDialog, ViewRange } from "./calendar-settings-dialog";
import { useCalendarConfig } from "./calendar-config";
import { useCalendarDnd } from "@/hooks/use-calendar-dnd";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// Types
interface TechnicianSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string; // "09:00"
  endTime: string;   // "19:00"
  isWorking: boolean;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  schedules?: TechnicianSchedule[];
}

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  serviceCategory?: string;
  technicianId: string;
  status: string;
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

interface ResourceCalendarProps {
  locations: Location[];
  technicians: Technician[];
  appointments: Appointment[];
  blocks?: TechnicianBlock[];
  selectedLocationIds: string[];
  selectedDate?: Date; // Initial date from parent (e.g., from localStorage)
  multiLocationMode?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  onLocationToggle: (locationId: string) => void;
  onDateChange: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onBlockClick?: (block: TechnicianBlock) => void;
  onSlotClick?: (technicianId: string, time: Date) => void;
  onScheduleClick?: () => void;
  onSettingsClick?: () => void;
  onMoreClick?: () => void;
  onMenuClick?: () => void; // For mobile navigation
  onMultiLocationModeChange?: (enabled: boolean) => void;
  onMoveAppointment?: (
    appointmentId: string,
    newTechnicianId: string,
    newStartTime: Date,
    newEndTime: Date,
    notifyClient: boolean
  ) => Promise<void>;
  onMoveBlock?: (
    blockId: string,
    newTechnicianId: string,
    newStartTime: Date,
    newEndTime: Date
  ) => Promise<void>;
  // Hide the built-in header (used when wrapped in MobileCalendarLayout)
  hideHeader?: boolean;
}

// Static calendar constants (same for mobile/desktop)
const CALENDAR_START_HOUR = 0; // Midnight
const CALENDAR_END_HOUR = 24; // Midnight next day
// Note: PIXELS_PER_HOUR, TIME_COLUMN_WIDTH, etc. are now in CalendarConfig (responsive)


// Generate time slots for the full day
const generateTimeSlots = (date: Date) => {
  const slots = [];
  for (let hour = CALENDAR_START_HOUR; hour < CALENDAR_END_HOUR; hour++) {
    const time = setMinutes(setHours(startOfDay(date), hour), 0);
    slots.push(time);
  }
  return slots;
};

// Format time for display
const formatTimeLabel = (hour: number) => {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

// Parse time string "HH:MM" to hours as decimal
const parseTimeToHours = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
};

// Get off-hours blocks for a technician on a specific day
const getOffHoursBlocks = (
  tech: Technician,
  dayOfWeek: number,
  calendarStartHour: number,
  calendarEndHour: number,
  pixelsPerHour: number
): { top: number; height: number }[] => {
  const blocks: { top: number; height: number }[] = [];

  // Find schedule for this day
  const schedule = tech.schedules?.find(s => s.dayOfWeek === dayOfWeek);

  if (!schedule || !schedule.isWorking) {
    // Not working - entire day is off
    return [{
      top: 0,
      height: (calendarEndHour - calendarStartHour) * pixelsPerHour
    }];
  }

  const workStart = parseTimeToHours(schedule.startTime);
  const workEnd = parseTimeToHours(schedule.endTime);

  // Before work hours
  if (workStart > calendarStartHour) {
    blocks.push({
      top: 0,
      height: (workStart - calendarStartHour) * pixelsPerHour
    });
  }

  // After work hours
  if (workEnd < calendarEndHour) {
    blocks.push({
      top: (workEnd - calendarStartHour) * pixelsPerHour,
      height: (calendarEndHour - workEnd) * pixelsPerHour
    });
  }

  return blocks;
};

// Calculate appointment position and height
const getAppointmentStyle = (
  appointment: Appointment,
  calendarDate: Date,
  calendarStartHour: number,
  calendarEndHour: number,
  pixelsPerHour: number
) => {
  const startHour = appointment.startTime.getHours();
  const startMinute = appointment.startTime.getMinutes();
  const endHour = appointment.endTime.getHours();
  const endMinute = appointment.endTime.getMinutes();

  // Calculate total minutes from calendar start
  const startMinutesFromMidnight = (startHour - calendarStartHour) * 60 + startMinute;
  let endMinutesFromMidnight = (endHour - calendarStartHour) * 60 + endMinute;

  // Check if appointment spans into the next day
  const appointmentSpansNextDay = !isSameDay(appointment.startTime, appointment.endTime);

  if (appointmentSpansNextDay) {
    // If appointment goes past midnight, extend to end of calendar (24 hours = 1440 minutes)
    // This makes the appointment "protrude" to the bottom of the day view
    endMinutesFromMidnight = (calendarEndHour - calendarStartHour) * 60;
  }

  const durationMinutes = endMinutesFromMidnight - startMinutesFromMidnight;

  // Convert minutes to pixels (pixelsPerHour / 60 = pixels per minute)
  const pixelsPerMinute = pixelsPerHour / 60;
  const top = startMinutesFromMidnight * pixelsPerMinute;
  const height = Math.max(durationMinutes * pixelsPerMinute, 20); // Minimum 20px height

  return { top, height, spansNextDay: appointmentSpansNextDay };
};

// localStorage keys for persisting calendar preferences
const STORAGE_KEY_TECH_IDS = "bloom_calendar_techIds";
const STORAGE_KEY_VIEW_RANGE = "bloom_calendar_viewRange";

export function ResourceCalendar({
  locations,
  technicians,
  appointments,
  blocks = [],
  selectedLocationIds,
  selectedDate: initialDate,
  multiLocationMode = false,
  settingsOpen: controlledSettingsOpen,
  onSettingsOpenChange,
  onLocationToggle,
  onDateChange,
  onAppointmentClick,
  onBlockClick,
  onSlotClick,
  onScheduleClick,
  onSettingsClick,
  onMoreClick,
  onMenuClick,
  onMultiLocationModeChange,
  onMoveAppointment,
  onMoveBlock,
  hideHeader = false,
}: ResourceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [staffSheetOpen, setStaffSheetOpen] = useState(false);

  // Get responsive calendar config
  const config = useCalendarConfig();

  // Use controlled state if provided, otherwise use internal state
  const settingsOpen = controlledSettingsOpen ?? internalSettingsOpen;
  const setSettingsOpen = onSettingsOpenChange ?? setInternalSettingsOpen;

  // Initialize viewRange from localStorage
  const [viewRange, setViewRange] = useState<ViewRange>(() => {
    if (typeof window === "undefined") return "day";
    const saved = localStorage.getItem(STORAGE_KEY_VIEW_RANGE);
    if (saved === "week" || saved === "month") return saved;
    return "day";
  });

  // Initialize selectedTechIds from localStorage
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(STORAGE_KEY_TECH_IDS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [hoveredSlot, setHoveredSlot] = useState<{
    technicianId: string;
    minutesFromMidnight: number;
  } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // DnD sensors - require movement to start drag (prevents accidental drags on click)
  // Disabled on mobile - tap to create is sufficient, drag conflicts with scroll
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Disable DnD entirely on mobile
  const activeSensors = config.isMobile ? [] : sensors;

  // Sync internal date state with prop (for when parent restores from localStorage)
  useEffect(() => {
    if (initialDate && initialDate.getTime() !== selectedDate.getTime()) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Track previous technician IDs to detect newly added ones
  const prevTechIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Auto-select technicians: restore from localStorage, select new ones when locations added
  useEffect(() => {
    if (technicians.length > 0) {
      const currentTechIds = new Set(technicians.map((t) => t.id));
      const prevTechIds = prevTechIdsRef.current;

      // Find newly added technicians (in current but not in previous)
      const newTechIds = technicians
        .filter((t) => !prevTechIds.has(t.id))
        .map((t) => t.id);

      // Find still-valid selections (techs that still exist)
      const validSelection = selectedTechIds.filter((id) => currentTechIds.has(id));

      let newSelection: string[];

      if (isFirstLoadRef.current) {
        // First load - restore from localStorage if valid, otherwise select all
        isFirstLoadRef.current = false;
        if (validSelection.length > 0) {
          // Restore saved preferences
          newSelection = validSelection;
        } else {
          // No valid saved preferences, select all
          newSelection = technicians.map((t) => t.id);
        }
      } else if (newTechIds.length > 0) {
        // New technicians added (new location toggled on) - add them to selection
        newSelection = [...validSelection, ...newTechIds];
      } else if (validSelection.length !== selectedTechIds.length) {
        // Some techs were removed (location toggled off) - keep valid ones
        newSelection = validSelection.length > 0 ? validSelection : technicians.map((t) => t.id);
      } else {
        // No changes needed
        prevTechIdsRef.current = currentTechIds;
        return;
      }

      setSelectedTechIds(newSelection);
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_TECH_IDS, JSON.stringify(newSelection));

      // Update ref for next comparison
      prevTechIdsRef.current = currentTechIds;
    }
  }, [technicians]);

  // Scroll to 8 AM at the top of viewport on mount
  useEffect(() => {
    if (gridRef.current) {
      const scrollPosition = 8 * config.PIXELS_PER_HOUR;
      gridRef.current.scrollTop = scrollPosition;
    }
  }, [config.PIXELS_PER_HOUR]);

  // Filter technicians based on selection
  const visibleTechnicians = useMemo(() => {
    return technicians.filter((t) => selectedTechIds.includes(t.id));
  }, [technicians, selectedTechIds]);


  // Filter appointments for selected date
  const dayAppointments = useMemo(() => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.startTime), selectedDate)
    );
  }, [appointments, selectedDate]);

  // Filter blocks for selected date
  const dayBlocks = useMemo(() => {
    return blocks.filter((block) =>
      isSameDay(new Date(block.startTime), selectedDate)
    );
  }, [blocks, selectedDate]);

  // Unified events by technician with overlap calculation (appointments + blocks together)
  const eventsByTech = useMemo(() => {
    const grouped: Record<string, {
      events: CalendarEvent[];
      positions: Map<string, OverlapPosition>;
    }> = {};

    visibleTechnicians.forEach((tech) => {
      // Convert appointments to CalendarEvents
      const techAppointments = dayAppointments
        .filter((apt) => apt.technicianId === tech.id)
        .map(appointmentToCalendarEvent);

      // Convert blocks to CalendarEvents
      const techBlocks = dayBlocks
        .filter((block) => block.technicianId === tech.id)
        .map(blockToCalendarEvent);

      // Combine and calculate unified overlap positions
      const allEvents = [...techAppointments, ...techBlocks];
      const positions = calculateUnifiedOverlapPositions(allEvents);

      grouped[tech.id] = { events: allEvents, positions };
    });

    return grouped;
  }, [dayAppointments, dayBlocks, visibleTechnicians]);

  // DnD hook for drag-and-drop functionality
  const {
    dragState,
    isDragging,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    selection,
    isSelecting,
    handleSelectionStart,
    handleSelectionMove,
    handleSelectionEnd,
    getSelectionStyle,
    pendingMove,
    clearPendingMove,
    pendingBlockMove,
    clearPendingBlockMove,
    getDragOverlayTechColor,
  } = useCalendarDnd({
    appointments: dayAppointments,
    blocks: dayBlocks,
    selectedDate,
    visibleTechnicians,
    gridRef,
    onSlotSelect: onSlotClick,
    pixelsPerHour: config.PIXELS_PER_HOUR,
    pixelsPerFifteenMin: config.PIXELS_PER_15_MIN,
    timeColumnWidth: config.TIME_COLUMN_WIDTH,
    headerHeight: config.HEADER_HEIGHT,
  });

  // Handle move confirmation
  const handleConfirmMove = useCallback(
    async (notifyClient: boolean) => {
      if (!pendingMove || !onMoveAppointment) return;

      const { appointment, newTime, newTechId } = pendingMove;
      const duration = appointment.endTime.getTime() - appointment.startTime.getTime();
      const newEndTime = new Date(newTime.getTime() + duration);

      setIsMoving(true);
      try {
        await onMoveAppointment(
          appointment.id,
          newTechId,
          newTime,
          newEndTime,
          notifyClient
        );
        clearPendingMove();
      } catch (error) {
        console.error("Failed to move appointment:", error);
        // Error is handled by parent, just clear the pending state
      } finally {
        setIsMoving(false);
      }
    },
    [pendingMove, onMoveAppointment, clearPendingMove]
  );

  // Handle block move (direct, no confirmation modal needed)
  // Using ref to track if a move is already in flight to prevent race conditions
  const blockMoveInFlight = useRef(false);

  const handleBlockMove = useCallback(async () => {
    if (!pendingBlockMove || !onMoveBlock) return;

    // Prevent double-execution race condition
    if (blockMoveInFlight.current) return;
    blockMoveInFlight.current = true;

    const { block, newTime, newTechId } = pendingBlockMove;
    const duration = new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    const newEndTime = new Date(newTime.getTime() + duration);

    setIsMoving(true);
    try {
      await onMoveBlock(block.id, newTechId, newTime, newEndTime);
      clearPendingBlockMove();
    } catch (error) {
      console.error("Failed to move block:", error);
      clearPendingBlockMove();
    } finally {
      setIsMoving(false);
      blockMoveInFlight.current = false;
    }
  }, [pendingBlockMove, onMoveBlock, clearPendingBlockMove]);

  // Auto-execute block moves (no confirmation needed for personal events)
  useEffect(() => {
    if (pendingBlockMove && onMoveBlock && !blockMoveInFlight.current) {
      handleBlockMove();
    }
  }, [pendingBlockMove, onMoveBlock, handleBlockMove]);

  // Calculate block position and height (similar to appointments)
  const getBlockStyle = (block: TechnicianBlock) => {
    const startHour = block.startTime.getHours();
    const startMinute = block.startTime.getMinutes();
    const endHour = block.endTime.getHours();
    const endMinute = block.endTime.getMinutes();

    const startMinutesFromMidnight = (startHour - config.CALENDAR_START_HOUR) * 60 + startMinute;
    let endMinutesFromMidnight = (endHour - config.CALENDAR_START_HOUR) * 60 + endMinute;

    // Check if block spans into the next day
    const blockSpansNextDay = !isSameDay(block.startTime, block.endTime);

    if (blockSpansNextDay) {
      // Extend to end of calendar
      endMinutesFromMidnight = (config.CALENDAR_END_HOUR - config.CALENDAR_START_HOUR) * 60;
    }

    const durationMinutes = endMinutesFromMidnight - startMinutesFromMidnight;

    const pixelsPerMinute = config.PIXELS_PER_HOUR / 60;
    const top = startMinutesFromMidnight * pixelsPerMinute;
    const height = Math.max(durationMinutes * pixelsPerMinute, 20);

    return { top, height, spansNextDay: blockSpansNextDay };
  };

  const timeSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    onDateChange(date);
  };

  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1);
    handleDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    handleDateChange(newDate);
  };

  // Handle mouse move for 15-minute hover highlights
  const handleGridMouseMove = (e: React.MouseEvent) => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    const rect = gridElement.getBoundingClientRect();
    const scrollTop = gridElement.scrollTop;

    // Calculate Y position relative to grid content
    // Account for: scroll position and sticky header height
    const relativeY = e.clientY - rect.top + scrollTop - config.HEADER_HEIGHT;
    // Calculate X position relative to technician columns (excluding time column)
    const relativeX = e.clientX - rect.left - config.TIME_COLUMN_WIDTH;

    // If mouse is in header area or time column, clear hover
    if (relativeX < 0 || relativeY < 0) {
      setHoveredSlot(null);
      return;
    }

    // Calculate which technician column
    const contentWidth = rect.width - config.TIME_COLUMN_WIDTH;
    const columnWidth = contentWidth / visibleTechnicians.length;
    const techIndex = Math.floor(relativeX / columnWidth);
    const tech = visibleTechnicians[techIndex];

    if (!tech) {
      setHoveredSlot(null);
      return;
    }

    // Snap to 15-minute increments
    const minutes = Math.floor(relativeY / config.PIXELS_PER_15_MIN) * 15;
    // Clamp to valid range
    const clampedMinutes = Math.max(0, Math.min(minutes, (config.CALENDAR_END_HOUR - config.CALENDAR_START_HOUR) * 60 - 15));

    setHoveredSlot({ technicianId: tech.id, minutesFromMidnight: clampedMinutes });
  };

  const handleGridMouseLeave = () => {
    setHoveredSlot(null);
  };

  // Calculate hover highlight position
  const getHoverHighlightStyle = () => {
    if (!hoveredSlot) return null;

    const techIndex = visibleTechnicians.findIndex(t => t.id === hoveredSlot.technicianId);
    if (techIndex === -1) return null;

    const columnWidth = 100 / visibleTechnicians.length;
    const top = hoveredSlot.minutesFromMidnight * (config.PIXELS_PER_HOUR / 60);

    return {
      top: `${top}px`,
      height: `${config.PIXELS_PER_15_MIN}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  };

  const totalGridHeight = (config.CALENDAR_END_HOUR - config.CALENDAR_START_HOUR) * config.PIXELS_PER_HOUR;

  // Toggle individual technician
  const handleTechToggle = (techId: string) => {
    let newSelection: string[];
    if (selectedTechIds.includes(techId)) {
      // Don't allow deselecting the last one
      if (selectedTechIds.length > 1) {
        newSelection = selectedTechIds.filter((id) => id !== techId);
      } else {
        return;
      }
    } else {
      newSelection = [...selectedTechIds, techId];
    }
    setSelectedTechIds(newSelection);
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_TECH_IDS, JSON.stringify(newSelection));

    // Reset to day view if moving to multiple staff and currently on week/month
    if (newSelection.length > 1 && (viewRange === "week" || viewRange === "month")) {
      setViewRange("day");
      localStorage.setItem(STORAGE_KEY_VIEW_RANGE, "day");
    }
  };

  // Handle view range change
  const handleViewRangeChange = (range: ViewRange) => {
    setViewRange(range);
    localStorage.setItem(STORAGE_KEY_VIEW_RANGE, range);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Mini Calendar + Staff */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0 hidden md:flex md:flex-col">
        <MiniCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
        />

        {/* Staff toggle pills - iOS style */}
        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Staff
          </div>
          <div className="flex flex-col gap-2">
            {technicians.map((tech) => {
              const isSelected = selectedTechIds.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200",
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                  style={isSelected ? { backgroundColor: tech.color } : undefined}
                  onClick={() => handleTechToggle(tech.id)}
                >
                  {/* Toggle checkbox indicator */}
                  <span
                    className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0",
                      isSelected
                        ? "border-white/50 bg-white/20"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {/* Color dot for unselected state */}
                  {!isSelected && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tech.color }}
                    />
                  )}
                  <span className="truncate">{tech.firstName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar with Mobile Staff Button - hidden when using MobileCalendarLayout */}
        {!hideHeader && (
        <div className="flex items-center border-b border-gray-200 bg-white">
          <CalendarHeader
            selectedDate={selectedDate}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onDateSelect={handleDateChange}
            locations={locations}
            selectedLocationIds={selectedLocationIds}
            multiLocationMode={multiLocationMode}
            onLocationToggle={onLocationToggle}
            onScheduleClick={onScheduleClick}
            onSettingsClick={() => setSettingsOpen(true)}
            onMoreClick={onMoreClick}
            onMenuClick={onMenuClick}
          />

          {/* Mobile Staff Selector Button */}
          {config.isMobile && (
            <Sheet open={staffSheetOpen} onOpenChange={setStaffSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 mr-2 flex-shrink-0"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Staff</SheetTitle>
                </SheetHeader>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                  <div className="flex flex-col gap-2">
                    {technicians.map((tech) => {
                      const isSelected = selectedTechIds.includes(tech.id);
                      return (
                        <button
                          key={tech.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200",
                            isSelected
                              ? "text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                          style={isSelected ? { backgroundColor: tech.color } : undefined}
                          onClick={() => handleTechToggle(tech.id)}
                        >
                          <span
                            className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0",
                              isSelected
                                ? "border-white/50 bg-white/20"
                                : "border-gray-300 bg-white"
                            )}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          {!isSelected && (
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tech.color }}
                            />
                          )}
                          <span className="truncate">{tech.firstName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
        )}

        {/* Calendar Grid */}
        <DndContext
          sensors={activeSensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        <div
          className={cn(
            "flex-1 overflow-auto custom-scrollbar calendar-scroll-container",
            isDragging && "cursor-grabbing"
          )}
          ref={gridRef}
          onMouseMove={(e) => {
            handleGridMouseMove(e);
            if (isSelecting) handleSelectionMove(e);
          }}
          onMouseLeave={handleGridMouseLeave}
          onMouseUp={() => {
            if (isSelecting) handleSelectionEnd();
          }}
        >
          <div>
            {/* Sticky header row - Tech names */}
            <div className="sticky top-0 z-30 flex bg-white border-b border-gray-200 isolate shadow-[0_1px_0_0_rgb(229,231,235)]">
              {/* Empty spacer for time column */}
              <div
                className="flex-shrink-0 border-r border-gray-200 bg-white"
                style={{ width: config.TIME_COLUMN_WIDTH }}
              />

              {/* Technician column headers */}
              {visibleTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className={cn(
                    "border-r border-gray-200 flex items-center justify-center min-w-0 flex-1 overflow-hidden bg-white",
                    config.isMobile ? "gap-0.5 py-1.5 px-0.5" : "gap-1 py-2"
                  )}
                >
                  <span className={cn(
                    "font-medium text-gray-700 truncate",
                    config.isMobile ? "text-[11px]" : "text-sm"
                  )}>
                    {tech.firstName}
                  </span>
                  {config.showSparkles && (
                    <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: tech.color }} />
                  )}
                </div>
              ))}
            </div>

            {/* Time grid with appointments */}
            <div className="relative z-10" style={{ height: totalGridHeight }}>
              {/* Hour lines that extend full width (including time axis) */}
              {timeSlots.map((slot, index) => (
                <div
                  key={`hour-line-${index}`}
                  className="absolute left-0 right-0 border-b border-gray-300"
                  style={{ top: index * config.PIXELS_PER_HOUR }}
                />
              ))}

              {/* 15-min and 30-min lines that extend full width */}
              {timeSlots.map((slot, index) => (
                <div key={`sub-lines-${index}`}>
                  {/* :15 line */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-200/60"
                    style={{ top: index * config.PIXELS_PER_HOUR + config.PIXELS_PER_15_MIN }}
                  />
                  {/* :30 line (slightly darker) */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-300/70"
                    style={{ top: index * config.PIXELS_PER_HOUR + config.PIXELS_PER_15_MIN * 2 }}
                  />
                  {/* :45 line */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-200/60"
                    style={{ top: index * config.PIXELS_PER_HOUR + config.PIXELS_PER_15_MIN * 3 }}
                  />
                </div>
              ))}

              {/* Time labels and clickable columns */}
              {timeSlots.map((slot, index) => (
                <div
                  key={index}
                  className="absolute left-0 right-0 flex"
                  style={{ top: index * config.PIXELS_PER_HOUR, height: config.PIXELS_PER_HOUR }}
                >
                  {/* Time label */}
                  <div
                    className={cn(
                      "flex-shrink-0 border-r border-gray-200 text-gray-500 text-right pt-0 whitespace-nowrap",
                      config.isMobile ? "px-1 text-[10px]" : "px-2 text-xs"
                    )}
                    style={{ width: config.TIME_COLUMN_WIDTH }}
                  >
                    {formatTimeLabel(slot.getHours())}
                  </div>

                  {/* Technician columns (clickable + drag-to-select) */}
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="border-r border-gray-200 cursor-pointer relative min-w-0 flex-1"
                      onClick={(e) => {
                        // Calculate 15-minute slot based on click position within the hour row
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relativeY = e.clientY - rect.top;
                        const quarterIndex = Math.floor((relativeY / config.PIXELS_PER_HOUR) * 4);
                        const minuteOffset = Math.min(quarterIndex, 3) * 15; // 0, 15, 30, or 45
                        const clickTime = addMinutes(slot, minuteOffset);
                        onSlotClick?.(tech.id, clickTime);
                      }}
                      onMouseDown={(e) => {
                        // Only start selection on primary mouse button
                        // Disable drag-to-select on mobile (conflicts with scroll)
                        if (e.button === 0 && onSlotClick && !config.isMobile) {
                          handleSelectionStart(e, tech.id);
                        }
                      }}
                    />
                  ))}
                </div>
              ))}

              {/* Off-hours overlay (darker gray zones) */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: config.TIME_COLUMN_WIDTH, right: 0 }}
              >
                <div className="flex h-full">
                  {visibleTechnicians.map((tech) => {
                    const dayOfWeek = selectedDate.getDay();
                    const offHoursBlocks = getOffHoursBlocks(
                      tech,
                      dayOfWeek,
                      config.CALENDAR_START_HOUR,
                      config.CALENDAR_END_HOUR,
                      config.PIXELS_PER_HOUR
                    );

                    return (
                      <div key={tech.id} className="relative min-w-0 flex-1">
                        {offHoursBlocks.map((block, idx) => (
                          <div
                            key={idx}
                            className="absolute left-0 right-0 bg-gray-200/50"
                            style={{
                              top: block.top,
                              height: block.height,
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 15-minute hover highlight (hidden during drag/selection) */}
              {hoveredSlot && !isDragging && !isSelecting && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: config.TIME_COLUMN_WIDTH, right: 0 }}
                >
                  <div className="relative h-full">
                    <div
                      className="absolute bg-gray-100/80 border border-gray-300/60 rounded-sm transition-all duration-75"
                      style={getHoverHighlightStyle() || undefined}
                    />
                  </div>
                </div>
              )}

              {/* Selection overlay for drag-to-create blocks */}
              {isSelecting && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: config.TIME_COLUMN_WIDTH, right: 0 }}
                >
                  <div className="relative h-full">
                    <div
                      className="absolute bg-gray-300/50 border-2 border-dashed border-gray-400 rounded"
                      style={getSelectionStyle() || undefined}
                    />
                  </div>
                </div>
              )}

              {/* Current time indicator - only show on today */}
              {isSameDay(selectedDate, new Date()) && (
                <TimeIndicator
                  startHour={config.CALENDAR_START_HOUR}
                  pixelsPerHour={config.PIXELS_PER_HOUR}
                  leftOffset={config.TIME_COLUMN_WIDTH}
                />
              )}

              {/* Unified events overlay (appointments + blocks with shared overlap calculation) */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{ left: config.TIME_COLUMN_WIDTH, right: 0 }}
              >
                <div className="flex h-full">
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="relative min-w-0 flex-1"
                    >
                      {eventsByTech[tech.id]?.events.map((event) => {
                        const overlapPosition = eventsByTech[tech.id].positions.get(event.id);
                        const { left, width } = overlapPosition || { left: 0, width: 100, zIndex: 10, isDominant: true };

                        if (event.type === "block") {
                          const block = event.originalData as TechnicianBlock;
                          const { top, height } = getBlockStyle(block);
                          const isBeingDragged = dragState.activeId === `block-${block.id}`;
                          // Hide block if it has a pending move (it will be shown at the new position)
                          const hasPendingBlockMove = pendingBlockMove?.block.id === block.id;

                          return (
                            <BlockCard
                              key={block.id}
                              block={block}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                              overlapPosition={overlapPosition}
                              onClick={() => onBlockClick?.(block)}
                              draggable={!config.isMobile && !!onMoveBlock && !isBeingDragged && !isMoving && !pendingBlockMove}
                              isBeingDragged={isBeingDragged || hasPendingBlockMove}
                            />
                          );
                        } else {
                          const apt = event.originalData as Appointment;
                          const { top, height } = getAppointmentStyle(
                            apt,
                            selectedDate,
                            config.CALENDAR_START_HOUR,
                            config.CALENDAR_END_HOUR,
                            config.PIXELS_PER_HOUR
                          );
                          // Hide appointment if it has a pending move (it will be shown at the new position)
                          const hasPendingMove = pendingMove?.appointment.id === apt.id;

                          return (
                            <AppointmentCard
                              key={apt.id}
                              id={apt.id}
                              startTime={new Date(apt.startTime)}
                              endTime={new Date(apt.endTime)}
                              clientName={apt.clientName}
                              serviceName={apt.serviceName}
                              serviceCategory={apt.serviceCategory}
                              status={apt.status}
                              techColor={tech.color}
                              technicianId={tech.id}
                              height={height}
                              overlapPosition={overlapPosition}
                              draggable={!config.isMobile && !!onMoveAppointment && !isMoving && !pendingMove}
                              className={cn("pointer-events-auto", hasPendingMove && "pointer-events-none")}
                              style={{
                                top: `${top}px`,
                                height: `${height - 2}px`,
                                left: `calc(${left}% + 2px)`,
                                width: `calc(${width}% - 5px)`,
                                ...(hasPendingMove && { opacity: 0 }),
                              }}
                              onClick={() => onAppointmentClick?.(apt)}
                            />
                          );
                        }
                      })}
                    </div>
                  ))}
                </div>

                {/* Pending move appointment - shown at new position while waiting for confirmation */}
                {pendingMove && (() => {
                  const techIndex = visibleTechnicians.findIndex(t => t.id === pendingMove.newTechId);
                  if (techIndex === -1) return null;

                  const columnWidth = 100 / visibleTechnicians.length;
                  const duration = pendingMove.appointment.endTime.getTime() - pendingMove.appointment.startTime.getTime();
                  const aptHeight = (duration / (1000 * 60)) * (config.PIXELS_PER_HOUR / 60);
                  const topPx = ((pendingMove.newTime.getHours() - config.CALENDAR_START_HOUR) * 60 +
                    pendingMove.newTime.getMinutes()) * (config.PIXELS_PER_HOUR / 60);
                  const pendingTech = visibleTechnicians[techIndex];

                  return (
                    <div
                      className="absolute rounded px-1.5 py-1 overflow-hidden pointer-events-none z-40"
                      style={{
                        backgroundColor: pendingTech?.color || "#888",
                        top: `${topPx}px`,
                        height: `${aptHeight - 2}px`,
                        left: `calc(${techIndex * columnWidth}% + 2px)`,
                        width: `calc(${columnWidth}% - 5px)`,
                      }}
                    >
                      <div className="text-xs font-medium text-white truncate">
                        {format(pendingMove.newTime, "h:mm a")}
                      </div>
                      {aptHeight > 30 && (
                        <div className="text-xs text-white font-medium truncate">
                          {pendingMove.appointment.clientName}
                        </div>
                      )}
                      {aptHeight > 45 && (
                        <div className="text-xs text-white/90 truncate">
                          {pendingMove.appointment.serviceName}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Pending move block - shown at new position while API call is in progress */}
                {pendingBlockMove && (() => {
                  const techIndex = visibleTechnicians.findIndex(t => t.id === pendingBlockMove.newTechId);
                  if (techIndex === -1) return null;

                  const columnWidth = 100 / visibleTechnicians.length;
                  const duration = new Date(pendingBlockMove.block.endTime).getTime() - new Date(pendingBlockMove.block.startTime).getTime();
                  const blockHeight = (duration / (1000 * 60)) * (config.PIXELS_PER_HOUR / 60);
                  const topPx = ((pendingBlockMove.newTime.getHours() - config.CALENDAR_START_HOUR) * 60 +
                    pendingBlockMove.newTime.getMinutes()) * (config.PIXELS_PER_HOUR / 60);

                  return (
                    <div
                      className="absolute rounded px-1.5 py-1 overflow-hidden pointer-events-none z-40"
                      style={{
                        backgroundColor: "#9E9E9E",
                        top: `${topPx}px`,
                        height: `${blockHeight}px`,
                        left: `calc(${techIndex * columnWidth}% + 2px)`,
                        width: `calc(${columnWidth}% - 5px)`,
                      }}
                    >
                      <div className="text-xs font-medium text-white truncate">
                        {format(pendingBlockMove.newTime, "h:mm a")}
                      </div>
                      {blockHeight > 30 && (
                        <div className="text-xs text-white font-medium truncate">
                          {pendingBlockMove.block.title}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Custom drag preview - positioned in grid, not following cursor */}
                {dragState.activeAppointment && dragState.currentTechId && dragState.currentTime && (() => {
                  const techIndex = visibleTechnicians.findIndex(t => t.id === dragState.currentTechId);
                  if (techIndex === -1) return null;

                  const columnWidth = 100 / visibleTechnicians.length;
                  const aptHeight = ((dragState.activeAppointment.endTime.getTime() -
                    dragState.activeAppointment.startTime.getTime()) / (1000 * 60)) * (config.PIXELS_PER_HOUR / 60);
                  const topPx = ((dragState.currentTime.getHours() - config.CALENDAR_START_HOUR) * 60 +
                    dragState.currentTime.getMinutes()) * (config.PIXELS_PER_HOUR / 60);

                  return (
                    <div
                      className={cn(
                        "absolute rounded overflow-hidden pointer-events-none z-50",
                        dragState.hasConflict && "ring-2 ring-amber-400 ring-offset-1"
                      )}
                      style={{
                        backgroundColor: getDragOverlayTechColor(),
                        opacity: 0.8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        top: `${topPx}px`,
                        height: `${aptHeight}px`,
                        left: `calc(${techIndex * columnWidth}% + 2px)`,
                        width: `calc(${columnWidth}% - 4px)`,
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-xs font-medium text-white truncate">
                        {format(dragState.currentTime, "h:mm a")}
                      </div>
                      {aptHeight > 30 && (
                        <div className="px-1.5 text-xs text-white/90 truncate">
                          {dragState.activeAppointment.clientName}
                        </div>
                      )}
                      {aptHeight > 45 && (
                        <div className="px-1.5 text-xs text-white/80 truncate">
                          {dragState.activeAppointment.serviceName}
                        </div>
                      )}
                      {dragState.hasConflict && aptHeight > 60 && (
                        <div className="px-1.5 text-xs text-amber-200 font-medium">
                          Will overlap
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Custom drag preview for blocks */}
                {dragState.activeBlock && dragState.currentTechId && dragState.currentTime && (() => {
                  const techIndex = visibleTechnicians.findIndex(t => t.id === dragState.currentTechId);
                  if (techIndex === -1) return null;

                  const columnWidth = 100 / visibleTechnicians.length;
                  const blockHeight = ((new Date(dragState.activeBlock.endTime).getTime() -
                    new Date(dragState.activeBlock.startTime).getTime()) / (1000 * 60)) * (config.PIXELS_PER_HOUR / 60);
                  const topPx = ((dragState.currentTime.getHours() - config.CALENDAR_START_HOUR) * 60 +
                    dragState.currentTime.getMinutes()) * (config.PIXELS_PER_HOUR / 60);

                  return (
                    <div
                      className="absolute rounded overflow-hidden pointer-events-none z-50"
                      style={{
                        backgroundColor: "#9E9E9E",
                        opacity: 0.8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        top: `${topPx}px`,
                        height: `${blockHeight}px`,
                        left: `calc(${techIndex * columnWidth}% + 2px)`,
                        width: `calc(${columnWidth}% - 4px)`,
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-xs font-medium text-white truncate">
                        {format(dragState.currentTime, "h:mm a")}
                      </div>
                      {blockHeight > 30 && (
                        <div className="px-1.5 text-xs text-white font-medium truncate">
                          {dragState.activeBlock.title}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Empty DragOverlay - just for dnd-kit, actual preview rendered above */}
        <DragOverlay dropAnimation={null} />
        </DndContext>
      </div>

      {/* Move Confirmation Modal */}
      {pendingMove && (
        <MoveConfirmationModal
          appointment={pendingMove.appointment}
          originalTime={pendingMove.originalTime}
          newTime={pendingMove.newTime}
          originalTechId={pendingMove.originalTechId}
          newTechId={pendingMove.newTechId}
          technicians={visibleTechnicians}
          onConfirm={handleConfirmMove}
          onCancel={clearPendingMove}
          isLoading={isMoving}
        />
      )}

      {/* Calendar Settings Dialog */}
      <CalendarSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        viewRange={viewRange}
        onViewRangeChange={handleViewRangeChange}
        selectedStaffCount={selectedTechIds.length}
        multiLocationMode={multiLocationMode}
        onMultiLocationModeChange={onMultiLocationModeChange}
        locations={locations}
        selectedLocationIds={selectedLocationIds}
        onLocationToggle={onLocationToggle}
      />

    </div>
  );
}
