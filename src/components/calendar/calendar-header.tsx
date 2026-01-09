"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Settings, MoreHorizontal, Check, Clock, CalendarDays, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCalendarConfig } from "./calendar-config";
import { MiniCalendar } from "./mini-calendar";

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface CalendarHeaderProps {
  selectedDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  onDateSelect: (date: Date) => void;
  locations: Location[];
  selectedLocationIds: string[];
  multiLocationMode?: boolean;
  onLocationToggle: (locationId: string) => void;
  onScheduleClick?: () => void;
  onSettingsClick?: () => void;
  onMoreClick?: () => void;
  onMenuClick?: () => void; // For mobile navigation
}

export function CalendarHeader({
  selectedDate,
  onPrevDay,
  onNextDay,
  onDateSelect,
  locations,
  selectedLocationIds,
  multiLocationMode = false,
  onLocationToggle,
  onScheduleClick,
  onSettingsClick,
  onMoreClick,
  onMenuClick,
}: CalendarHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const config = useCalendarConfig();

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by not rendering date until mounted
  const dateDisplay = mounted ? format(selectedDate, config.isMobile ? "M/d" : "MMM d") : "...";

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
    setDatePickerOpen(false);
  };

  return (
    <div className={cn(
      "flex items-center justify-between bg-white flex-1",
      config.isMobile ? "gap-1 px-2 py-1.5" : "gap-2 px-4 py-2"
    )}>
      {/* Left side - Menu (mobile), Date navigation and filters */}
      <div className={cn(
        "flex items-center min-w-0",
        config.isMobile ? "gap-1" : "gap-2 flex-wrap"
      )}>
        {/* Mobile menu button */}
        {config.isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full flex-shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Date navigation */}
        <div className="flex items-center flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full", config.isMobile ? "h-7 w-7" : "h-8 w-8")}
            onClick={onPrevDay}
          >
            <ChevronLeft className={cn(config.isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </Button>

          {/* Date display - tappable on mobile to open date picker */}
          {config.isMobile ? (
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                  <span className="font-medium text-xs">{dateDisplay}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <MiniCalendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <span className="px-2 text-sm font-medium text-center min-w-[80px]">
              {dateDisplay}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full", config.isMobile ? "h-7 w-7" : "h-8 w-8")}
            onClick={onNextDay}
          >
            <ChevronRight className={cn(config.isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </Button>
        </div>

        {/* Location pills - hidden on mobile (use settings instead) */}
        {!config.isMobile && (
          <div className="flex items-center gap-2">
            {locations.map((location) => {
              const isSelected = selectedLocationIds.includes(location.id);
              return (
                <button
                  key={location.id}
                  className={cn(
                    "relative flex items-center rounded-full font-medium cursor-pointer transition-all duration-200 whitespace-nowrap flex-shrink-0",
                    "gap-2 px-3 py-1.5 text-sm",
                    isSelected
                      ? "bg-[#1E1B4B] text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                  onClick={() => onLocationToggle(location.id)}
                >
                  {/* Toggle indicator - only shown in multi-location mode */}
                  {multiLocationMode && (
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
                  )}
                  {location.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side - Actions */}
      <div className={cn("flex items-center flex-shrink-0", config.isMobile ? "gap-1" : "gap-2")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-gray-100 hover:bg-gray-200",
            config.isMobile ? "h-7 w-7" : "h-9 w-9"
          )}
          onClick={onMoreClick}
        >
          <MoreHorizontal className={cn(config.isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-gray-100 hover:bg-gray-200",
            config.isMobile ? "h-7 w-7" : "h-9 w-9"
          )}
          onClick={onSettingsClick}
        >
          <Settings className={cn(config.isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-gray-100 hover:bg-gray-200",
            config.isMobile ? "h-7 w-7" : "h-9 w-9"
          )}
          onClick={onScheduleClick}
        >
          <Clock className={cn(config.isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </Button>
      </div>
    </div>
  );
}
