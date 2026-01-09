"use client";

import { useState } from "react";
import { MobileCalendarHeader } from "./mobile-calendar-header";
import { MobileWeekStrip } from "./mobile-week-strip";
import { MobileSettingsSheet } from "./mobile-settings-sheet";
import { MobileDatePickerSheet } from "./mobile-date-picker-sheet";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId: string;
}

interface Location {
  id: string;
  name: string;
}

type EventType = "appointment" | "personal_event";

interface MobileCalendarLayoutProps {
  // Children - the calendar grid
  children: React.ReactNode;
  // Date
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  // Technicians
  technicians: Technician[];
  selectedTechIds: string[];
  onTechToggle: (techId: string) => void;
  // Locations
  locations: Location[];
  // Schedule
  onEditScheduleClick?: () => void;
  // Create event
  onCreateEvent: (type: EventType, technicianId?: string) => void;
}

export function MobileCalendarLayout({
  children,
  selectedDate,
  onDateChange,
  technicians,
  selectedTechIds,
  onTechToggle,
  locations,
  onEditScheduleClick,
  onCreateEvent,
}: MobileCalendarLayoutProps) {
  // Sheet states
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Settings state (could be lifted to parent or persisted)
  const [viewMode, setViewMode] = useState<"day" | "week" | "list">("day");
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showUnconfirmed, setShowUnconfirmed] = useState(true);
  const [showServiceBefore, setShowServiceBefore] = useState(true);
  const [showServiceAfter, setShowServiceAfter] = useState(true);
  const [showCanceled, setShowCanceled] = useState(false);
  const [colorBy, setColorBy] = useState<"staff" | "service">("staff");

  const handleCreateEvent = (type: EventType) => {
    onCreateEvent(type);
  };

  return (
    <div className="mobile-calendar-shell">
      {/* Header */}
      <MobileCalendarHeader
        selectedDate={selectedDate}
        onSettingsClick={() => setSettingsSheetOpen(true)}
        onMonthClick={() => setDatePickerOpen(true)}
        createMenuOpen={createMenuOpen}
        onCreateMenuOpenChange={setCreateMenuOpen}
        onCreateEvent={handleCreateEvent}
      />

      {/* Week strip */}
      <MobileWeekStrip
        selectedDate={selectedDate}
        onDateSelect={onDateChange}
      />

      {/* Calendar content */}
      <div className="mobile-content-with-nav">
        {children}
      </div>

      {/* Sheets/Modals - Bottom nav is now in admin layout */}
      <MobileSettingsSheet
        open={settingsSheetOpen}
        onOpenChange={setSettingsSheetOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        technicians={technicians}
        selectedTechIds={selectedTechIds}
        onTechToggle={onTechToggle}
        locations={locations}
        showConfirmed={showConfirmed}
        onShowConfirmedChange={setShowConfirmed}
        showUnconfirmed={showUnconfirmed}
        onShowUnconfirmedChange={setShowUnconfirmed}
        showServiceBefore={showServiceBefore}
        onShowServiceBeforeChange={setShowServiceBefore}
        showServiceAfter={showServiceAfter}
        onShowServiceAfterChange={setShowServiceAfter}
        showCanceled={showCanceled}
        onShowCanceledChange={setShowCanceled}
        colorBy={colorBy}
        onColorByChange={setColorBy}
        onEditScheduleClick={onEditScheduleClick}
      />

      <MobileDatePickerSheet
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        selectedDate={selectedDate}
        onDateSelect={onDateChange}
      />
    </div>
  );
}
