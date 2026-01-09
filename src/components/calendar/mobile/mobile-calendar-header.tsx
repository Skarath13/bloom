"use client";

import { format } from "date-fns";
import { MoreHorizontal, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileCalendarHeaderProps {
  selectedDate: Date;
  onSettingsClick: () => void;
  onMonthClick: () => void;
  onCreateClick: () => void;
}

export function MobileCalendarHeader({
  selectedDate,
  onSettingsClick,
  onMonthClick,
  onCreateClick,
}: MobileCalendarHeaderProps) {
  return (
    <header className="flex items-center justify-between h-12 px-3 bg-white border-b border-gray-200 flex-shrink-0 safe-area-inset-top">
      {/* Left - Settings (3 dots) */}
      <button
        onClick={onSettingsClick}
        className={cn(
          "min-w-[44px] min-h-[44px] flex items-center justify-center",
          "rounded-full active:bg-gray-100 transition-colors"
        )}
        aria-label="Calendar settings"
      >
        <MoreHorizontal className="h-6 w-6 text-gray-700" />
      </button>

      {/* Center - Month/Year picker */}
      <button
        onClick={onMonthClick}
        className={cn(
          "flex items-center gap-1 px-3 min-h-[44px]",
          "rounded-lg active:bg-gray-100 transition-colors"
        )}
        aria-label="Select date"
      >
        <span className="text-lg font-semibold text-gray-900">
          {format(selectedDate, "MMMM yyyy")}
        </span>
        <ChevronDown className="h-5 w-5 text-gray-500" />
      </button>

      {/* Right - Create button */}
      <button
        onClick={onCreateClick}
        className={cn(
          "min-w-[44px] min-h-[44px] flex items-center justify-center",
          "rounded-full active:bg-gray-100 transition-colors"
        )}
        aria-label="Create new"
      >
        <Plus className="h-7 w-7 text-gray-700" />
      </button>
    </header>
  );
}
