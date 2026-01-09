"use client";

import { format } from "date-fns";
import { MoreHorizontal, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type EventType = "appointment" | "personal_event";

interface MobileCalendarHeaderProps {
  selectedDate: Date;
  onSettingsClick: () => void;
  onMonthClick: () => void;
  createMenuOpen: boolean;
  onCreateMenuOpenChange: (open: boolean) => void;
  onCreateEvent: (type: EventType) => void;
}

const menuItems: { type: EventType; label: string }[] = [
  { type: "appointment", label: "Create appointment" },
  { type: "personal_event", label: "Create personal event" },
];

export function MobileCalendarHeader({
  selectedDate,
  onSettingsClick,
  onMonthClick,
  createMenuOpen,
  onCreateMenuOpenChange,
  onCreateEvent,
}: MobileCalendarHeaderProps) {
  const handleSelect = (type: EventType) => {
    onCreateEvent(type);
    onCreateMenuOpenChange(false);
  };

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

      {/* Right - Create button with popover */}
      <Popover open={createMenuOpen} onOpenChange={onCreateMenuOpenChange}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
              "rounded-full active:bg-gray-100 transition-colors"
            )}
            aria-label="Create new"
          >
            <Plus className="h-7 w-7 text-gray-700" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={4}
          className="w-[220px] p-0 rounded-xl shadow-lg border border-gray-200"
        >
          <div className="py-2">
            {menuItems.map((item, index) => (
              <button
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className={cn(
                  "w-full text-left px-4 py-3 text-base text-gray-900",
                  "active:bg-gray-100 transition-colors",
                  "min-h-[48px]",
                  index !== menuItems.length - 1 && "border-b border-gray-100"
                )}
              >
                {item.label}
              </button>
            ))}

            {/* Cancel button */}
            <button
              onClick={() => onCreateMenuOpenChange(false)}
              className={cn(
                "w-full text-left px-4 py-3 text-base text-gray-500",
                "active:bg-gray-100 transition-colors",
                "min-h-[48px] border-t border-gray-200 mt-1"
              )}
            >
              Cancel
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}
