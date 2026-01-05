"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerProps {
  time: string; // Format: "HH:mm" (24-hour)
  onTimeChange: (time: string) => void;
  className?: string;
  placeholder?: string;
  interval?: number; // Minutes between options (default 15)
}

// Generate time options
const generateTimeOptions = (interval: number = 15) => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "am" : "pm";
      const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
};

// Format 24-hour time to display format
const formatTimeDisplay = (time: string): string => {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "am" : "pm";
  return `${hour12}:${minute} ${ampm}`;
};

export function TimePicker({
  time,
  onTimeChange,
  className,
  placeholder = "Select time",
  interval = 15,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const timeOptions = React.useMemo(() => generateTimeOptions(interval), [interval]);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Scroll to selected time when popover opens
  React.useEffect(() => {
    if (open && listRef.current && time) {
      const selectedElement = listRef.current.querySelector(`[data-value="${time}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "center" });
      }
    }
  }, [open, time]);

  const handleSelectTime = (value: string) => {
    onTimeChange(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-sm text-gray-900 hover:text-gray-600 cursor-pointer text-left",
            !time && "text-gray-400",
            className
          )}
        >
          {time ? formatTimeDisplay(time) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-0" align="start">
        <div
          ref={listRef}
          className="max-h-[240px] overflow-y-auto py-1"
        >
          {timeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              data-value={option.value}
              onClick={() => handleSelectTime(option.value)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 cursor-pointer transition-colors",
                time === option.value && "bg-gray-900 text-white hover:bg-gray-800"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
