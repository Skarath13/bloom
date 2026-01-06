"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Settings, MoreHorizontal, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
}

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
}: CalendarHeaderProps) {
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

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
