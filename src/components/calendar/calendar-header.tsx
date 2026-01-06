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
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
}

type RangeType = "day" | "week" | "month";

interface CalendarHeaderProps {
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  locations: Location[];
  selectedLocationIds: string[];
  onLocationToggle: (locationId: string) => void;
  onScheduleClick?: () => void;
  onSettingsClick?: () => void;
  onMoreClick?: () => void;
  range?: RangeType;
  onRangeChange?: (range: RangeType) => void;
}

export function CalendarHeader({
  selectedDate,
  onPrevDay,
  onNextDay,
  locations,
  selectedLocationIds,
  onLocationToggle,
  onScheduleClick,
  onSettingsClick,
  onMoreClick,
  range = "day",
  onRangeChange,
}: CalendarHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const rangeLabels: Record<RangeType, string> = {
    day: "Day",
    week: "Week",
    month: "Month",
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
            {dateDisplay}
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
              <span className="font-medium">{rangeLabels[range]}</span>
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

        {/* Location toggle pills - iOS style */}
        <div className="flex items-center gap-2">
          {locations.map((location) => {
            const isSelected = selectedLocationIds.includes(location.id);
            return (
              <button
                key={location.id}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-200",
                  isSelected
                    ? "bg-[#1E1B4B] text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
                onClick={() => onLocationToggle(location.id)}
              >
                {/* Toggle indicator */}
                <span
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                    isSelected
                      ? "border-white bg-white"
                      : "border-gray-400"
                  )}
                >
                  {isSelected && (
                    <Check className="w-3 h-3 text-[#1E1B4B]" />
                  )}
                </span>
                {location.name}
              </button>
            );
          })}
        </div>
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
