"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { addDays, subDays, startOfDay, setHours, setMinutes, isSameDay, format } from "date-fns";
import { Sparkles } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type Modifier,
} from "@dnd-kit/core";
import { MiniCalendar } from "./mini-calendar";
import { CalendarHeader } from "./calendar-header";
import { AppointmentCard, calculateOverlapPositions } from "./appointment-card";
import { BlockCard } from "./block-card";
import { TimeIndicator, getCurrentTimeScrollPosition } from "./time-indicator";
import { MoveConfirmationModal } from "./move-confirmation-modal";
import { useCalendarDnd } from "@/hooks/use-calendar-dnd";
import { cn } from "@/lib/utils";

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
  selectedLocationId: string;
  selectedDate?: Date; // Initial date from parent (e.g., from localStorage)
  onLocationChange: (locationId: string) => void;
  onDateChange: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onBlockClick?: (block: TechnicianBlock) => void;
  onSlotClick?: (technicianId: string, time: Date) => void;
  onScheduleClick?: () => void;
  onSettingsClick?: () => void;
  onMoreClick?: () => void;
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
}

// Calendar configuration
const CALENDAR_START_HOUR = 0; // Midnight
const CALENDAR_END_HOUR = 24; // Midnight next day
const PIXELS_PER_HOUR = 80; // 80px per hour for better visibility
const PIXELS_PER_15_MIN = 20; // 20px per 15 minutes (snap increment)
const TIME_COLUMN_WIDTH = 56; // Width of time column in pixels
const HEADER_HEIGHT = 37; // Height of sticky technician header row

// Factory to create snap modifier with access to grid dimensions
const createSnapModifier = (
  gridRef: React.RefObject<HTMLDivElement | null>,
  techCount: number
): Modifier => {
  return ({ transform, activatorEvent }) => {
    // Snap Y to 15-minute grid
    const snappedY = Math.round(transform.y / PIXELS_PER_15_MIN) * PIXELS_PER_15_MIN;

    // Snap X to technician columns
    let snappedX = transform.x;
    const gridElement = gridRef.current;

    if (gridElement && techCount > 0 && activatorEvent instanceof PointerEvent) {
      const rect = gridElement.getBoundingClientRect();
      const contentWidth = rect.width - TIME_COLUMN_WIDTH;
      const columnWidth = contentWidth / techCount;

      // Get initial X position relative to grid content area
      const initialX = activatorEvent.clientX - rect.left - TIME_COLUMN_WIDTH;
      // Get current X with transform applied
      const currentX = initialX + transform.x;

      // Calculate which column we started in and which we're now in
      const startColumn = Math.floor(initialX / columnWidth);
      const currentColumn = Math.floor(currentX / columnWidth);

      // Clamp to valid column range
      const targetColumn = Math.max(0, Math.min(currentColumn, techCount - 1));

      // Calculate snapped X: difference between target column center and start column center
      const columnDelta = targetColumn - startColumn;
      snappedX = columnDelta * columnWidth;
    }

    return {
      ...transform,
      x: snappedX,
      y: snappedY,
    };
  };
};

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
const getAppointmentStyle = (appointment: Appointment, calendarDate: Date) => {
  const startHour = appointment.startTime.getHours();
  const startMinute = appointment.startTime.getMinutes();
  const endHour = appointment.endTime.getHours();
  const endMinute = appointment.endTime.getMinutes();

  // Calculate total minutes from calendar start
  const startMinutesFromMidnight = (startHour - CALENDAR_START_HOUR) * 60 + startMinute;
  let endMinutesFromMidnight = (endHour - CALENDAR_START_HOUR) * 60 + endMinute;

  // Check if appointment spans into the next day
  const appointmentSpansNextDay = !isSameDay(appointment.startTime, appointment.endTime);

  if (appointmentSpansNextDay) {
    // If appointment goes past midnight, extend to end of calendar (24 hours = 1440 minutes)
    // This makes the appointment "protrude" to the bottom of the day view
    endMinutesFromMidnight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;
  }

  const durationMinutes = endMinutesFromMidnight - startMinutesFromMidnight;

  // Convert minutes to pixels (PIXELS_PER_HOUR / 60 = pixels per minute)
  const pixelsPerMinute = PIXELS_PER_HOUR / 60;
  const top = startMinutesFromMidnight * pixelsPerMinute;
  const height = Math.max(durationMinutes * pixelsPerMinute, 20); // Minimum 20px height

  return { top, height, spansNextDay: appointmentSpansNextDay };
};

export function ResourceCalendar({
  locations,
  technicians,
  appointments,
  blocks = [],
  selectedLocationId,
  selectedDate: initialDate,
  onLocationChange,
  onDateChange,
  onAppointmentClick,
  onBlockClick,
  onSlotClick,
  onScheduleClick,
  onSettingsClick,
  onMoreClick,
  onMoveAppointment,
  onMoveBlock,
}: ResourceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [autoSelectScheduled, setAutoSelectScheduled] = useState(true);
  const [hoveredSlot, setHoveredSlot] = useState<{
    technicianId: string;
    minutesFromMidnight: number;
  } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // DnD sensors - require 5px movement to start drag (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Sync internal date state with prop (for when parent restores from localStorage)
  useEffect(() => {
    if (initialDate && initialDate.getTime() !== selectedDate.getTime()) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Auto-select all technicians when they load or when location changes
  useEffect(() => {
    if (technicians.length > 0) {
      // Check if current selection contains any valid tech IDs for this location
      const validSelection = selectedTechIds.filter((id) =>
        technicians.some((t) => t.id === id)
      );

      // If no valid selection (e.g., location changed), auto-select all
      if (validSelection.length === 0) {
        setSelectedTechIds(technicians.map((t) => t.id));
      } else if (validSelection.length !== selectedTechIds.length) {
        // Clean up invalid IDs
        setSelectedTechIds(validSelection);
      }
    }
  }, [technicians]);

  // Scroll to position current time at top third of viewport on mount
  useEffect(() => {
    if (gridRef.current) {
      const viewportHeight = gridRef.current.clientHeight;
      const scrollPosition = getCurrentTimeScrollPosition(
        CALENDAR_START_HOUR,
        PIXELS_PER_HOUR,
        viewportHeight
      );
      gridRef.current.scrollTop = scrollPosition;
    }
  }, []);

  // Filter technicians based on selection
  const visibleTechnicians = useMemo(() => {
    return technicians.filter((t) => selectedTechIds.includes(t.id));
  }, [technicians, selectedTechIds]);

  // Snap modifier - snaps to 15-min grid vertically and technician columns horizontally
  const snapModifier = useMemo(
    () => createSnapModifier(gridRef, visibleTechnicians.length),
    [visibleTechnicians.length]
  );

  // Filter appointments for selected date
  const dayAppointments = useMemo(() => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.startTime), selectedDate)
    );
  }, [appointments, selectedDate]);

  // Group appointments by technician with overlap calculation
  const appointmentsByTech = useMemo(() => {
    const grouped: Record<string, Array<Appointment & { overlapPosition: { left: number; width: number } }>> = {};

    visibleTechnicians.forEach((tech) => {
      const techAppointments = dayAppointments.filter(
        (apt) => apt.technicianId === tech.id
      );

      // Calculate overlap positions
      const positions = calculateOverlapPositions(techAppointments);

      grouped[tech.id] = techAppointments.map((apt) => ({
        ...apt,
        overlapPosition: positions.get(apt.id) || { left: 0, width: 100 },
      }));
    });

    return grouped;
  }, [dayAppointments, visibleTechnicians]);

  // Filter blocks for selected date
  const dayBlocks = useMemo(() => {
    return blocks.filter((block) =>
      isSameDay(new Date(block.startTime), selectedDate)
    );
  }, [blocks, selectedDate]);

  // Group blocks by technician
  const blocksByTech = useMemo(() => {
    const grouped: Record<string, TechnicianBlock[]> = {};

    visibleTechnicians.forEach((tech) => {
      grouped[tech.id] = dayBlocks.filter(
        (block) => block.technicianId === tech.id
      );
    });

    return grouped;
  }, [dayBlocks, visibleTechnicians]);

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

    const startMinutesFromMidnight = (startHour - CALENDAR_START_HOUR) * 60 + startMinute;
    let endMinutesFromMidnight = (endHour - CALENDAR_START_HOUR) * 60 + endMinute;

    // Check if block spans into the next day
    const blockSpansNextDay = !isSameDay(block.startTime, block.endTime);

    if (blockSpansNextDay) {
      // Extend to end of calendar
      endMinutesFromMidnight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;
    }

    const durationMinutes = endMinutesFromMidnight - startMinutesFromMidnight;

    const pixelsPerMinute = PIXELS_PER_HOUR / 60;
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
    const relativeY = e.clientY - rect.top + scrollTop - HEADER_HEIGHT;
    // Calculate X position relative to technician columns (excluding time column)
    const relativeX = e.clientX - rect.left - TIME_COLUMN_WIDTH;

    // If mouse is in header area or time column, clear hover
    if (relativeX < 0 || relativeY < 0) {
      setHoveredSlot(null);
      return;
    }

    // Calculate which technician column
    const contentWidth = rect.width - TIME_COLUMN_WIDTH;
    const columnWidth = contentWidth / visibleTechnicians.length;
    const techIndex = Math.floor(relativeX / columnWidth);
    const tech = visibleTechnicians[techIndex];

    if (!tech) {
      setHoveredSlot(null);
      return;
    }

    // Snap to 15-minute increments
    const minutes = Math.floor(relativeY / PIXELS_PER_15_MIN) * 15;
    // Clamp to valid range
    const clampedMinutes = Math.max(0, Math.min(minutes, (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 - 15));

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
    const top = hoveredSlot.minutesFromMidnight * (PIXELS_PER_HOUR / 60);

    return {
      top: `${top}px`,
      height: `${PIXELS_PER_15_MIN}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  };

  const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Mini Calendar */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0 hidden md:block">
        <MiniCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
        />
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <CalendarHeader
          selectedDate={selectedDate}
          onPrevDay={handlePrevDay}
          onNextDay={handleNextDay}
          locations={locations}
          selectedLocationId={selectedLocationId}
          onLocationChange={onLocationChange}
          technicians={technicians}
          selectedTechIds={selectedTechIds}
          onTechSelectionChange={setSelectedTechIds}
          autoSelectScheduled={autoSelectScheduled}
          onAutoSelectChange={setAutoSelectScheduled}
          onScheduleClick={onScheduleClick}
          onSettingsClick={onSettingsClick}
          onMoreClick={onMoreClick}
        />

        {/* Calendar Grid */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        <div
          className="flex-1 overflow-auto custom-scrollbar"
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
            <div className="sticky top-0 z-10 flex bg-white border-b border-gray-200">
              {/* Empty spacer for time column */}
              <div
                className="flex-shrink-0 border-r border-gray-200"
                style={{ width: TIME_COLUMN_WIDTH }}
              />

              {/* Technician column headers */}
              {visibleTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className="border-r border-gray-200 flex items-center justify-center gap-1 py-2 min-w-0 flex-1 overflow-hidden"
                >
                  <span className="font-medium text-sm text-gray-700 truncate">
                    {tech.firstName}
                  </span>
                  <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: tech.color }} />
                </div>
              ))}
            </div>

            {/* Time grid with appointments */}
            <div className="relative" style={{ height: totalGridHeight }}>
              {/* Hour lines that extend full width (including time axis) */}
              {timeSlots.map((slot, index) => (
                <div
                  key={`hour-line-${index}`}
                  className="absolute left-0 right-0 border-b border-gray-300"
                  style={{ top: index * PIXELS_PER_HOUR }}
                />
              ))}

              {/* 15-min and 30-min lines that extend full width */}
              {timeSlots.map((slot, index) => (
                <div key={`sub-lines-${index}`}>
                  {/* :15 line */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-200/60"
                    style={{ top: index * PIXELS_PER_HOUR + PIXELS_PER_15_MIN }}
                  />
                  {/* :30 line (slightly darker) */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-300/70"
                    style={{ top: index * PIXELS_PER_HOUR + PIXELS_PER_15_MIN * 2 }}
                  />
                  {/* :45 line */}
                  <div
                    className="absolute left-0 right-0 border-b border-gray-200/60"
                    style={{ top: index * PIXELS_PER_HOUR + PIXELS_PER_15_MIN * 3 }}
                  />
                </div>
              ))}

              {/* Time labels and clickable columns */}
              {timeSlots.map((slot, index) => (
                <div
                  key={index}
                  className="absolute left-0 right-0 flex"
                  style={{ top: index * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}
                >
                  {/* Time label */}
                  <div
                    className="flex-shrink-0 border-r border-gray-200 px-2 text-xs text-gray-500 text-right pt-0"
                    style={{ width: TIME_COLUMN_WIDTH }}
                  >
                    {formatTimeLabel(slot.getHours())}
                  </div>

                  {/* Technician columns (clickable + drag-to-select) */}
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="border-r border-gray-200 cursor-pointer relative min-w-0 flex-1"
                      onClick={() => onSlotClick?.(tech.id, slot)}
                      onMouseDown={(e) => {
                        // Only start selection on primary mouse button
                        if (e.button === 0 && onSlotClick) {
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
                style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
              >
                <div className="flex h-full">
                  {visibleTechnicians.map((tech) => {
                    const dayOfWeek = selectedDate.getDay();
                    const offHoursBlocks = getOffHoursBlocks(
                      tech,
                      dayOfWeek,
                      CALENDAR_START_HOUR,
                      CALENDAR_END_HOUR,
                      PIXELS_PER_HOUR
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
                  style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
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
                  style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
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
                  startHour={CALENDAR_START_HOUR}
                  pixelsPerHour={PIXELS_PER_HOUR}
                  leftOffset={TIME_COLUMN_WIDTH}
                />
              )}

              {/* Personal events/blocks overlay */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
              >
                <div className="flex h-full">
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="relative min-w-0 flex-1"
                    >
                      {blocksByTech[tech.id]?.map((block) => {
                        const { top, height } = getBlockStyle(block);
                        // Hide the original block if it's being dragged
                        const isBeingDragged = dragState.activeId === `block-${block.id}`;

                        return (
                          <BlockCard
                            key={block.id}
                            block={block}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                            onClick={() => onBlockClick?.(block)}
                            draggable={!!onMoveBlock && !isBeingDragged && !isMoving && !pendingBlockMove}
                            isBeingDragged={isBeingDragged}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Appointments overlay */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
              >
                <div className="flex h-full">
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="relative min-w-0 flex-1"
                    >
                      {appointmentsByTech[tech.id]?.map((apt) => {
                        const { top, height, spansNextDay } = getAppointmentStyle(apt, selectedDate);
                        const { left, width } = apt.overlapPosition;

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
                            draggable={!!onMoveAppointment && !isMoving && !pendingMove}
                            className="pointer-events-auto"
                            style={{
                              top: `${top}px`,
                              height: `${height - 2}px`, // 2px bottom gap between adjacent appointments
                              left: `calc(${left}% + 2px)`,
                              width: `calc(${width}% - 5px)`, // 1px extra for gap between side-by-side appointments
                            }}
                            onClick={() => onAppointmentClick?.(apt)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drag Overlay - Moving appointment card */}
        <DragOverlay modifiers={[snapModifier]} dropAnimation={null}>
          {dragState.activeAppointment && (() => {
            // Calculate column width to match the original card size
            const gridWidth = gridRef.current?.clientWidth || 800;
            const columnWidth = (gridWidth - TIME_COLUMN_WIDTH) / visibleTechnicians.length;
            // Account for padding (2px on each side)
            const cardWidth = columnWidth - 4;
            const aptHeight = ((dragState.activeAppointment.endTime.getTime() -
              dragState.activeAppointment.startTime.getTime()) / (1000 * 60)) * (PIXELS_PER_HOUR / 60);

            return (
              <div
                className={cn(
                  "rounded overflow-hidden pointer-events-none",
                  dragState.hasConflict && "ring-2 ring-amber-400 ring-offset-1"
                )}
                style={{
                  backgroundColor: getDragOverlayTechColor(),
                  opacity: 0.75,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  width: `${cardWidth}px`,
                  height: `${aptHeight}px`,
                }}
              >
                <div className="px-1.5 py-0.5 text-xs font-medium text-white truncate">
                  {format(dragState.currentTime || dragState.activeAppointment.startTime, "h:mm a")}
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
          {dragState.activeBlock && (() => {
            // Calculate column width to match the original card size
            const gridWidth = gridRef.current?.clientWidth || 800;
            const columnWidth = (gridWidth - TIME_COLUMN_WIDTH) / visibleTechnicians.length;
            // Account for padding (2px on each side)
            const cardWidth = columnWidth - 4;

            const blockHeight = ((new Date(dragState.activeBlock.endTime).getTime() -
              new Date(dragState.activeBlock.startTime).getTime()) / (1000 * 60)) * (PIXELS_PER_HOUR / 60);

            return (
              <div
                className="rounded overflow-hidden pointer-events-none"
                style={{
                  backgroundColor: "#9E9E9E",
                  opacity: 0.75,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  width: `${cardWidth}px`,
                  height: `${blockHeight}px`,
                }}
              >
                <div className="px-1.5 py-0.5 text-xs font-medium text-white truncate">
                  {format(dragState.currentTime || dragState.activeBlock.startTime, "h:mm a")}
                </div>
                {blockHeight > 30 && (
                  <div className="px-1.5 text-xs text-white font-medium truncate">
                    {dragState.activeBlock.title}
                  </div>
                )}
              </div>
            );
          })()}
        </DragOverlay>
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

    </div>
  );
}
