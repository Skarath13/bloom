"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Settings, MoreHorizontal, ChevronDown, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId?: string;
}

type RangeType = "day" | "week" | "month";
type ViewType = "side-by-side" | "stacked";

interface CalendarHeaderProps {
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  locations: Location[];
  selectedLocationId: string;
  onLocationChange: (locationId: string) => void;
  technicians: Technician[];
  selectedTechIds: string[];
  onTechSelectionChange: (techIds: string[]) => void;
  autoSelectScheduled: boolean;
  onAutoSelectChange: (value: boolean) => void;
  onScheduleClick?: () => void;
  onSettingsClick?: () => void;
  onMoreClick?: () => void;
  range?: RangeType;
  onRangeChange?: (range: RangeType) => void;
  view?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

export function CalendarHeader({
  selectedDate,
  onPrevDay,
  onNextDay,
  locations,
  selectedLocationId,
  onLocationChange,
  technicians,
  selectedTechIds,
  onTechSelectionChange,
  autoSelectScheduled,
  onAutoSelectChange,
  onScheduleClick,
  onSettingsClick,
  onMoreClick,
  range = "day",
  onRangeChange,
  view = "side-by-side",
  onViewChange,
}: CalendarHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectAll = () => {
    if (selectedTechIds.length === technicians.length) {
      onTechSelectionChange([]);
    } else {
      onTechSelectionChange(technicians.map((t) => t.id));
    }
  };

  const handleTechToggle = (techId: string) => {
    if (selectedTechIds.includes(techId)) {
      onTechSelectionChange(selectedTechIds.filter((id) => id !== techId));
    } else {
      onTechSelectionChange([...selectedTechIds, techId]);
    }
  };

  const isAllSelected = selectedTechIds.length === technicians.length;
  const isPartialSelected = selectedTechIds.length > 0 && selectedTechIds.length < technicians.length;

  const rangeLabels: Record<RangeType, string> = {
    day: "Day",
    week: "Week",
    month: "Month",
  };

  const viewLabels: Record<ViewType, string> = {
    "side-by-side": "Side-by-side",
    stacked: "Stacked",
  };

  // Avoid hydration mismatch by not rendering date until mounted
  const dateDisplay = mounted ? format(selectedDate, "MMM d") : "...";

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      {/* Left side - Date navigation and filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date navigation */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onPrevDay}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium min-w-[80px] text-center">
            Date {dateDisplay}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onNextDay}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Range selector (pill style with dropdown) */}
        <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
          <PopoverTrigger asChild>
            <button className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-1">
              Range <span className="font-medium">{rangeLabels[range]}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            {(Object.keys(rangeLabels) as RangeType[]).map((r) => (
              <button
                key={r}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-100",
                  range === r && "bg-gray-50"
                )}
                onClick={() => {
                  onRangeChange?.(r);
                  setRangeOpen(false);
                }}
              >
                {rangeLabels[r]}
                {range === r && <Check className="h-4 w-4 text-gray-600" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Location selector (pill style with dropdown) */}
        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger asChild>
            <button className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-1">
              Location <span className="font-medium">{selectedLocation?.name || "Select"}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {locations.map((location) => (
              <button
                key={location.id}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-100",
                  selectedLocationId === location.id && "bg-gray-50"
                )}
                onClick={() => {
                  onLocationChange(location.id);
                  setLocationOpen(false);
                }}
              >
                {location.name}
                {selectedLocationId === location.id && <Check className="h-4 w-4 text-gray-600" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* View selector (pill style with dropdown) */}
        <Popover open={viewOpen} onOpenChange={setViewOpen}>
          <PopoverTrigger asChild>
            <button className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-1">
              View <span className="font-medium">{viewLabels[view]}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            {(Object.keys(viewLabels) as ViewType[]).map((v) => (
              <button
                key={v}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-100",
                  view === v && "bg-gray-50"
                )}
                onClick={() => {
                  onViewChange?.(v);
                  setViewOpen(false);
                }}
              >
                {viewLabels[v]}
                {view === v && <Check className="h-4 w-4 text-gray-600" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Staff selector (pill style with dropdown) */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-1">
              Staff <span className="font-medium">{selectedTechIds.length} selected</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            {/* Auto-select toggle */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <span className="text-sm">Automatically select scheduled staff</span>
              <Switch
                checked={autoSelectScheduled}
                onCheckedChange={onAutoSelectChange}
              />
            </div>

            {/* Select all */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={handleSelectAll}
            >
              <span className="text-sm font-medium">Select All</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{technicians.length}</span>
                <Checkbox
                  checked={isAllSelected}
                  className={cn(isPartialSelected && "data-[state=checked]:bg-gray-400")}
                />
              </div>
            </div>

            {/* Technician list */}
            <div className="max-h-64 overflow-y-auto">
              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleTechToggle(tech.id)}
                >
                  {/* Color bar */}
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ backgroundColor: tech.color }}
                  />
                  {/* Name with sparkle */}
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-sm">{tech.firstName}</span>
                    <Sparkles className="h-3 w-3" style={{ color: tech.color }} />
                    <span className="text-sm text-gray-500">{selectedLocation?.name}</span>
                  </div>
                  {/* Checkbox */}
                  <Checkbox checked={selectedTechIds.includes(tech.id)} />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200"
          onClick={onMoreClick}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200"
          onClick={onSettingsClick}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200"
          onClick={onScheduleClick}
        >
          <Clock className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
