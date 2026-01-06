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

// Format 24-hour time to display format (12-hour with am/pm)
const formatTimeDisplay = (time: string): string => {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "am" : "pm";
  return `${hour12}:${minute} ${ampm}`;
};

// Parse various time input formats to 24-hour "HH:mm"
const parseTimeInput = (input: string): string | null => {
  if (!input) return null;

  const cleaned = input.trim().toLowerCase();

  // Try to extract am/pm
  const hasAm = cleaned.includes("a");
  const hasPm = cleaned.includes("p");
  const numericPart = cleaned.replace(/[^0-9:]/g, "");

  let hour = 0;
  let minute = 0;

  if (numericPart.includes(":")) {
    // Format: "9:30" or "09:30"
    const [h, m] = numericPart.split(":");
    hour = parseInt(h, 10);
    minute = parseInt(m, 10) || 0;
  } else if (numericPart.length <= 2) {
    // Format: "9" or "10" (just hour)
    hour = parseInt(numericPart, 10);
    minute = 0;
  } else if (numericPart.length === 3) {
    // Format: "930" -> 9:30
    hour = parseInt(numericPart[0], 10);
    minute = parseInt(numericPart.slice(1), 10);
  } else if (numericPart.length === 4) {
    // Format: "0930" or "1030" -> 09:30 or 10:30
    hour = parseInt(numericPart.slice(0, 2), 10);
    minute = parseInt(numericPart.slice(2), 10);
  } else {
    return null;
  }

  // Validate
  if (isNaN(hour) || isNaN(minute) || minute < 0 || minute > 59) {
    return null;
  }

  // Handle 12-hour to 24-hour conversion
  if (hour > 24 || hour < 0) return null;

  // If hour is 1-12 and we have am/pm indicators, convert appropriately
  if (hour >= 1 && hour <= 12) {
    if (hasPm && hour !== 12) {
      hour += 12;
    } else if (hasAm && hour === 12) {
      hour = 0;
    }
    // If no am/pm indicator, favor business hours (8am-8pm)
    // This makes "2" -> 2pm, "9" -> 9am, "7" -> 7pm (evening), etc.
    if (!hasAm && !hasPm) {
      if (hour >= 1 && hour <= 7) {
        // 1-7 without am/pm -> assume PM (1pm-7pm are common appointment times)
        hour += 12;
      }
      // 8-11 without am/pm -> assume AM (8am-11am are common morning times)
      // 12 without am/pm -> assume PM (noon, not midnight)
      if (hour === 12) {
        // 12 stays as 12 (noon)
      }
    }
  }

  // Clamp hour to valid range
  if (hour > 23) hour = 23;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export function TimePicker({
  time,
  onTimeChange,
  className,
  placeholder = "Select time",
  interval = 15,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [inputError, setInputError] = React.useState(false);
  const timeOptions = React.useMemo(() => generateTimeOptions(interval), [interval]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset input value when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(time ? formatTimeDisplay(time) : "");
      setInputError(false);
      // Focus input after a brief delay to let popover render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, time]);

  // Scroll to selected time when popover opens
  React.useEffect(() => {
    if (open && listRef.current && time) {
      // Delay to ensure DOM is ready
      setTimeout(() => {
        const selectedElement = listRef.current?.querySelector(`[data-value="${time}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "center" });
        }
      }, 50);
    }
  }, [open, time]);

  const handleSelectTime = (value: string) => {
    onTimeChange(value);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setInputError(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const parsed = parseTimeInput(inputValue);
      if (parsed) {
        onTimeChange(parsed);
        setOpen(false);
      } else {
        setInputError(true);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleInputBlur = () => {
    // Don't auto-save on blur to allow clicking dropdown options
    // User must press Enter or click an option
  };

  // Filter and sort options based on input
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return timeOptions;

    const search = inputValue.toLowerCase().replace(/[^0-9apm:]/g, "");
    const searchNum = inputValue.replace(/[^0-9]/g, ""); // Just digits

    // Filter matching options
    const matches = timeOptions.filter((opt) => {
      const labelClean = opt.label.toLowerCase().replace(/\s/g, "");
      const valueClean = opt.value.replace(":", "");
      return labelClean.includes(search) || valueClean.includes(search) || opt.label.toLowerCase().includes(inputValue.toLowerCase());
    });

    // Sort: prioritize options that START with the search number
    // e.g., typing "2" should show "2:00 pm" before "2:00 am" (business hours first)
    matches.sort((a, b) => {
      const aHour = a.label.split(":")[0];
      const bHour = b.label.split(":")[0];
      const aStartsWith = aHour === searchNum || aHour.startsWith(searchNum);
      const bStartsWith = bHour === searchNum || bHour.startsWith(searchNum);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // If both start with the number, prioritize business hours (8am-8pm)
      if (aStartsWith && bStartsWith) {
        const aIsPm = a.label.includes("pm");
        const bIsPm = b.label.includes("pm");
        const aHourNum = parseInt(aHour, 10);
        const bHourNum = parseInt(bHour, 10);

        // Business hours priority: 8am-11am, then 12pm-7pm
        const getBusinessPriority = (hourNum: number, isPm: boolean) => {
          if (!isPm && hourNum >= 8 && hourNum <= 11) return 0; // 8am-11am: highest priority
          if (isPm && (hourNum === 12 || (hourNum >= 1 && hourNum <= 7))) return 1; // 12pm-7pm: high priority
          if (isPm && hourNum >= 8 && hourNum <= 11) return 2; // 8pm-11pm: medium priority
          return 3; // 12am-7am: lowest priority (late night/early morning)
        };

        const aPriority = getBusinessPriority(aHourNum, aIsPm);
        const bPriority = getBusinessPriority(bHourNum, bIsPm);

        if (aPriority !== bPriority) return aPriority - bPriority;
      }

      // Secondary sort by time value
      return a.value.localeCompare(b.value);
    });

    return matches;
  }, [timeOptions, inputValue]);

  // Check if current input would parse to a valid time not in the dropdown
  const customTimePreview = React.useMemo(() => {
    if (!inputValue.trim()) return null;
    const parsed = parseTimeInput(inputValue);
    if (!parsed) return null;

    // Check if this exact time is already in the filtered options
    const existsInOptions = filteredOptions.some(opt => opt.value === parsed);
    if (existsInOptions) return null;

    return {
      value: parsed,
      label: formatTimeDisplay(parsed),
    };
  }, [inputValue, filteredOptions]);

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
      <PopoverContent className="w-40 p-0" align="start">
        {/* Manual input at top */}
        <div className="p-2 border-b border-gray-200">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            placeholder="9:30am"
            className={cn(
              "w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              inputError ? "border-red-400 bg-red-50" : "border-gray-300"
            )}
          />
          {inputError && (
            <p className="text-xs text-red-500 mt-1">Invalid time format</p>
          )}
        </div>

        {/* Time options list */}
        <div
          ref={listRef}
          className="max-h-[200px] overflow-y-auto py-1"
        >
          {/* Custom time option (for non-standard minutes like :23) */}
          {customTimePreview && (
            <button
              type="button"
              onClick={() => handleSelectTime(customTimePreview.value)}
              className="w-full px-3 py-1.5 text-sm text-left bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors text-blue-700 border-b border-blue-100"
            >
              {customTimePreview.label}
              <span className="text-blue-400 text-xs ml-2">↵ Enter</span>
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                data-value={option.value}
                onClick={() => handleSelectTime(option.value)}
                className={cn(
                  "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 cursor-pointer transition-colors",
                  time === option.value && "bg-gray-900 text-white hover:bg-gray-800"
                )}
              >
                {option.label}
              </button>
            ))
          ) : !customTimePreview ? (
            <p className="px-3 py-2 text-sm text-gray-400">No matching times</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
