"use client";

import { useState } from "react";
import { Check, Info, Calendar, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ViewRange = "day" | "week" | "month";

type SettingsSection = "view-range" | "location";

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface CalendarSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  viewRange: ViewRange;
  onViewRangeChange: (range: ViewRange) => void;
  selectedStaffCount: number;
  multiLocationMode?: boolean;
  onMultiLocationModeChange?: (enabled: boolean) => void;
  // Location selection (for mobile - location pills hidden)
  locations?: Location[];
  selectedLocationIds?: string[];
  onLocationToggle?: (locationId: string) => void;
}

const VIEW_RANGE_OPTIONS: { value: ViewRange; label: string; description: string }[] = [
  { value: "day", label: "Day", description: "View one day at a time" },
  { value: "week", label: "Week", description: "View a full week (single staff only)" },
  { value: "month", label: "Month", description: "View a full month (single staff only)" },
];

export function CalendarSettingsDialog({
  open,
  onClose,
  viewRange,
  onViewRangeChange,
  selectedStaffCount,
  multiLocationMode = false,
  onMultiLocationModeChange,
  locations = [],
  selectedLocationIds = [],
  onLocationToggle,
}: CalendarSettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("view-range");
  const isSingleStaff = selectedStaffCount === 1;

  const handleRangeSelect = (range: ViewRange) => {
    // Week and Month views only work with single staff
    if ((range === "week" || range === "month") && !isSingleStaff) {
      return;
    }
    onViewRangeChange(range);
  };

  // Show location section if we have locations to select from or multi-location mode is available
  const showLocationSection = locations.length > 0 || onMultiLocationModeChange;

  const sidebarItems = [
    { id: "view-range" as const, label: "View Range", icon: Calendar },
    ...(showLocationSection
      ? [{ id: "location" as const, label: "Location", icon: MapPin }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[650px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Calendar Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[400px]">
          {/* Left Sidebar */}
          <div className="w-48 border-r bg-gray-50/50 p-3 flex flex-col gap-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-[#1E1B4B] text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6">
            {/* View Range Section */}
            {activeSection === "view-range" && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">View Range</h3>

                {/* Info message for multi-staff */}
                {!isSingleStaff && (
                  <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Week and Month views are only available when viewing a single staff member.
                      Select one staff member in the sidebar to enable these options.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {VIEW_RANGE_OPTIONS.map((option) => {
                    const isDisabled = (option.value === "week" || option.value === "month") && !isSingleStaff;
                    const isSelected = viewRange === option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() => handleRangeSelect(option.value)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                          isSelected
                            ? "border-[#1E1B4B] bg-[#1E1B4B]/5"
                            : "border-gray-200 hover:border-gray-300",
                          isDisabled && "opacity-50 cursor-not-allowed hover:border-gray-200"
                        )}
                      >
                        <div className="text-left">
                          <div className={cn(
                            "font-medium",
                            isSelected ? "text-[#1E1B4B]" : "text-gray-900"
                          )}>
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {option.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location Section */}
            {activeSection === "location" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Select Location</h3>
                  <div className="space-y-2">
                    {locations.map((location) => {
                      const isSelected = selectedLocationIds.includes(location.id);
                      return (
                        <button
                          key={location.id}
                          onClick={() => onLocationToggle?.(location.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                            isSelected
                              ? "border-[#1E1B4B] bg-[#1E1B4B]/5"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <MapPin className={cn(
                              "w-4 h-4",
                              isSelected ? "text-[#1E1B4B]" : "text-gray-400"
                            )} />
                            <span className={cn(
                              "font-medium",
                              isSelected ? "text-[#1E1B4B]" : "text-gray-900"
                            )}>
                              {location.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-location mode toggle */}
                {onMultiLocationModeChange && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Advanced</h3>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white">
                      <div className="text-left pr-4">
                        <div className="font-medium text-gray-900">
                          Multi-Location Mode
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          View multiple locations simultaneously.
                        </div>
                      </div>
                      <Switch
                        checked={multiLocationMode}
                        onCheckedChange={onMultiLocationModeChange}
                        className="cursor-pointer data-[state=checked]:bg-[#1E1B4B]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
