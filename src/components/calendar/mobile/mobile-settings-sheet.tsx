"use client";

import { X, ChevronRight, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type ViewMode = "day" | "week" | "list";
type ColorBy = "staff" | "service";

interface MobileSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // View settings
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  // Technician settings
  technicians: Technician[];
  selectedTechIds: string[];
  onTechToggle: (techId: string) => void;
  // Location info for display
  locations: Location[];
  // Appointment attributes
  showConfirmed: boolean;
  onShowConfirmedChange: (show: boolean) => void;
  showUnconfirmed: boolean;
  onShowUnconfirmedChange: (show: boolean) => void;
  showServiceBefore: boolean;
  onShowServiceBeforeChange: (show: boolean) => void;
  showServiceAfter: boolean;
  onShowServiceAfterChange: (show: boolean) => void;
  // Additional filters
  showCanceled: boolean;
  onShowCanceledChange: (show: boolean) => void;
  // Color coding
  colorBy: ColorBy;
  onColorByChange: (colorBy: ColorBy) => void;
  // Schedule actions
  onEditScheduleClick?: () => void;
}

export function MobileSettingsSheet({
  open,
  onOpenChange,
  viewMode,
  onViewModeChange,
  technicians,
  selectedTechIds,
  onTechToggle,
  locations,
  showConfirmed,
  onShowConfirmedChange,
  showUnconfirmed,
  onShowUnconfirmedChange,
  showServiceBefore,
  onShowServiceBeforeChange,
  showServiceAfter,
  onShowServiceAfterChange,
  showCanceled,
  onShowCanceledChange,
  colorBy,
  onColorByChange,
  onEditScheduleClick,
}: MobileSettingsSheetProps) {
  const getLocationName = (locationId: string) => {
    return locations.find((l) => l.id === locationId)?.name || "";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden"
        style={{ height: "100dvh" }}
      >
        {/* Accessibility (visually hidden) */}
        <SheetTitle className="sr-only">Calendar Settings</SheetTitle>
        <SheetDescription className="sr-only">
          Configure calendar view, filters, and display options
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold pr-10">
            Calendar
          </h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* BOOKING AVAILABILITY */}
          <SectionHeader>Booking Availability</SectionHeader>
          <NavItem
            label="Make a one-time change"
            onClick={onEditScheduleClick}
          />
          <NavItem
            label="Edit repeating schedule"
            onClick={onEditScheduleClick}
          />

          {/* CALENDAR VIEW */}
          <SectionHeader>Calendar View</SectionHeader>
          <RadioOption
            label="Day"
            selected={viewMode === "day"}
            onSelect={() => onViewModeChange("day")}
          />
          <RadioOption
            label="Week"
            selected={viewMode === "week"}
            onSelect={() => onViewModeChange("week")}
          />
          <RadioOption
            label="List"
            selected={viewMode === "list"}
            onSelect={() => onViewModeChange("list")}
          />

          {/* EMPLOYEES */}
          <SectionHeader>Employees</SectionHeader>
          {technicians.map((tech) => (
            <TechnicianRow
              key={tech.id}
              technician={tech}
              locationName={getLocationName(tech.locationId)}
              selected={selectedTechIds.includes(tech.id)}
              onToggle={() => onTechToggle(tech.id)}
            />
          ))}

          {/* APPOINTMENT ATTRIBUTES */}
          <SectionHeader>Appointment Attributes</SectionHeader>
          <p className="px-4 text-sm text-gray-500 mb-2">
            Select which appointment attributes to show on your calendar.
          </p>
          <ToggleRow
            icon={<Check className="h-4 w-4" />}
            label="Confirmed"
            checked={showConfirmed}
            onCheckedChange={onShowConfirmedChange}
          />
          <ToggleRow
            icon={<span className="text-sm font-bold">?</span>}
            label="Unconfirmed"
            checked={showUnconfirmed}
            onCheckedChange={onShowUnconfirmedChange}
          />
          <ToggleRow
            icon={<span className="text-sm">↑</span>}
            label="Service before (multi-staff)"
            checked={showServiceBefore}
            onCheckedChange={onShowServiceBeforeChange}
          />
          <ToggleRow
            icon={<span className="text-sm">↓</span>}
            label="Service after (multi-staff)"
            checked={showServiceAfter}
            onCheckedChange={onShowServiceAfterChange}
          />

          {/* ADDITIONAL FILTERS */}
          <SectionHeader>Additional Filters Section</SectionHeader>
          <ToggleRow
            icon={<span className="text-[10px] border border-gray-400 px-0.5 rounded">10am</span>}
            label="Show canceled bookings"
            checked={showCanceled}
            onCheckedChange={onShowCanceledChange}
          />

          {/* COLOR CODE */}
          <SectionHeader>Color Code</SectionHeader>
          <RadioOption
            label="By Staff"
            selected={colorBy === "staff"}
            onSelect={() => onColorByChange("staff")}
          />
          <RadioOption
            label="By Service"
            selected={colorBy === "service"}
            onSelect={() => onColorByChange("service")}
          />
          <p className="px-4 text-sm text-gray-500 mt-2 mb-4">
            Assign colors to your services by editing them in the Service Library
          </p>

          {/* Spacer for bottom button */}
          <div className="h-20" />
        </div>

        {/* Done button - fixed at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-inset-bottom">
          <Button
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Helper Components

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-6 pb-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {children}
      </h2>
      <div className="h-px bg-gray-200 mt-2" />
    </div>
  );
}

function NavItem({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 min-h-[52px] active:bg-gray-100"
    >
      <span className="text-base text-gray-900">{label}</span>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </button>
  );
}

function RadioOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between px-4 py-4 min-h-[52px] active:bg-gray-100"
    >
      <span className="text-base text-gray-900">{label}</span>
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
          selected
            ? "border-blue-600 bg-blue-600"
            : "border-gray-300"
        )}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function TechnicianRow({
  technician,
  locationName,
  selected,
  onToggle,
}: {
  technician: { firstName: string; lastName: string; color: string };
  locationName: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] active:bg-gray-100"
    >
      {/* Color bar */}
      <div
        className="w-1 h-10 rounded-full"
        style={{ backgroundColor: technician.color }}
      />
      {/* Name and location */}
      <div className="flex-1 text-left">
        <span className="text-base text-gray-900">
          {technician.firstName}
        </span>
        {locationName && (
          <span className="text-base text-gray-500 ml-2">
            {locationName}
          </span>
        )}
      </div>
      {/* Checkbox */}
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
          selected
            ? "border-gray-900 bg-gray-900"
            : "border-gray-300"
        )}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </div>
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
        {icon}
      </div>
      {/* Label */}
      <span className="flex-1 text-base text-gray-900">{label}</span>
      {/* Switch */}
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-blue-600"
      />
    </div>
  );
}
