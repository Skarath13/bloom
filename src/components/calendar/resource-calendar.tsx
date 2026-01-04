"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { addDays, subDays, startOfDay, setHours, setMinutes, isSameDay } from "date-fns";
import { Sparkles } from "lucide-react";
import { MiniCalendar } from "./mini-calendar";
import { CalendarHeader } from "./calendar-header";
import { AppointmentCard, calculateOverlapPositions } from "./appointment-card";
import { TimeIndicator, getCurrentTimeScrollPosition } from "./time-indicator";

// Types
interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
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

interface ResourceCalendarProps {
  locations: Location[];
  technicians: Technician[];
  appointments: Appointment[];
  selectedLocationId: string;
  selectedDate?: Date; // Initial date from parent (e.g., from localStorage)
  onLocationChange: (locationId: string) => void;
  onDateChange: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onSlotClick?: (technicianId: string, time: Date) => void;
}

// Calendar configuration
const CALENDAR_START_HOUR = 0; // Midnight
const CALENDAR_END_HOUR = 24; // Midnight next day
const PIXELS_PER_HOUR = 80; // 80px per hour for better visibility
const PIXELS_PER_15_MIN = 20; // 20px per 15 minutes (snap increment)
const TIME_COLUMN_WIDTH = 56; // Width of time column in pixels

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

// Calculate appointment position and height
const getAppointmentStyle = (appointment: Appointment) => {
  const startHour = appointment.startTime.getHours();
  const startMinute = appointment.startTime.getMinutes();
  const endHour = appointment.endTime.getHours();
  const endMinute = appointment.endTime.getMinutes();

  // Calculate total minutes from calendar start
  const startMinutesFromMidnight = (startHour - CALENDAR_START_HOUR) * 60 + startMinute;
  const endMinutesFromMidnight = (endHour - CALENDAR_START_HOUR) * 60 + endMinute;
  const durationMinutes = endMinutesFromMidnight - startMinutesFromMidnight;

  // Convert minutes to pixels (PIXELS_PER_HOUR / 60 = pixels per minute)
  const pixelsPerMinute = PIXELS_PER_HOUR / 60;
  const top = startMinutesFromMidnight * pixelsPerMinute;
  const height = Math.max(durationMinutes * pixelsPerMinute, 20); // Minimum 20px height

  return { top, height };
};

export function ResourceCalendar({
  locations,
  technicians,
  appointments,
  selectedLocationId,
  selectedDate: initialDate,
  onLocationChange,
  onDateChange,
  onAppointmentClick,
  onSlotClick,
}: ResourceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [autoSelectScheduled, setAutoSelectScheduled] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Mini Calendar */}
      <div className="w-64 border-r flex-shrink-0 hidden md:block">
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
        />

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto custom-scrollbar" ref={gridRef}>
          <div>
            {/* Sticky header row - Tech names */}
            <div className="sticky top-0 z-10 flex bg-white border-b">
              {/* Empty spacer for time column */}
              <div
                className="flex-shrink-0 border-r"
                style={{ width: TIME_COLUMN_WIDTH }}
              />

              {/* Technician column headers */}
              {visibleTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className="border-r flex items-center justify-center gap-1 py-2 min-w-0 flex-1 overflow-hidden"
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

                  {/* Technician columns (clickable) */}
                  {visibleTechnicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="border-r border-gray-200 hover:bg-gray-50/50 cursor-pointer transition-colors relative min-w-0 flex-1"
                      onClick={() => onSlotClick?.(tech.id, slot)}
                    />
                  ))}
                </div>
              ))}

              {/* Current time indicator */}
              <TimeIndicator
                startHour={CALENDAR_START_HOUR}
                pixelsPerHour={PIXELS_PER_HOUR}
                leftOffset={TIME_COLUMN_WIDTH}
              />

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
                        const { top, height } = getAppointmentStyle(apt);
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
                            height={height}
                            className="pointer-events-auto"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(${left}% + 2px)`,
                              width: `calc(${width}% - 4px)`,
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
      </div>
    </div>
  );
}
