"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DurationPickerProps {
  duration: number; // Duration in minutes
  onDurationChange: (duration: number) => void;
  className?: string;
  placeholder?: string;
}

// Common duration options in minutes
const DURATION_OPTIONS = [
  5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
  195, 210, 225, 240, 270, 300, 330, 360, 420, 480, 540, 600, 660, 720
];

// Format minutes to display string
const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
};

// Parse various duration input formats to minutes
const parseDurationInput = (input: string): number | null => {
  if (!input) return null;

  const cleaned = input.trim().toLowerCase();

  // Try various formats

  // Format: "1h 30m" or "1h30m" or "1h 30" or "1h30"
  const hhmm = cleaned.match(/^(\d+)\s*h\s*(\d+)\s*m?$/);
  if (hhmm) {
    const hours = parseInt(hhmm[1], 10);
    const mins = parseInt(hhmm[2], 10);
    return hours * 60 + mins;
  }

  // Format: "1.5h" or "1.5 h" or "1.5 hours"
  const decimalHours = cleaned.match(/^(\d+\.?\d*)\s*h/);
  if (decimalHours) {
    const hours = parseFloat(decimalHours[1]);
    return Math.round(hours * 60);
  }

  // Format: "90m" or "90 m" or "90 min" or "90 minutes"
  const minutesMatch = cleaned.match(/^(\d+)\s*m/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  // Format: "1:30" (hours:minutes)
  const colonFormat = cleaned.match(/^(\d+):(\d+)$/);
  if (colonFormat) {
    const hours = parseInt(colonFormat[1], 10);
    const mins = parseInt(colonFormat[2], 10);
    return hours * 60 + mins;
  }

  // Format: just a number - interpret based on size
  const justNumber = cleaned.match(/^(\d+)$/);
  if (justNumber) {
    const num = parseInt(justNumber[1], 10);
    // If it's a small number (1-12), could be hours
    // If larger, assume minutes
    // But for simplicity, let's assume minutes for any plain number
    return num;
  }

  return null;
};

export function DurationPicker({
  duration,
  onDurationChange,
  className,
  placeholder = "Select duration",
}: DurationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [inputError, setInputError] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset input value when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(duration ? formatDuration(duration) : "");
      setInputError(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, duration]);

  // Scroll to selected duration when popover opens
  React.useEffect(() => {
    if (open && listRef.current && duration) {
      setTimeout(() => {
        const selectedElement = listRef.current?.querySelector(`[data-value="${duration}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "center" });
        }
      }, 50);
    }
  }, [open, duration]);

  const handleSelectDuration = (value: number) => {
    onDurationChange(value);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setInputError(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const parsed = parseDurationInput(inputValue);
      if (parsed && parsed > 0 && parsed <= 1440) { // Max 24 hours
        onDurationChange(parsed);
        setOpen(false);
      } else {
        setInputError(true);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Filter and sort options based on input
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return DURATION_OPTIONS;

    const parsed = parseDurationInput(inputValue);
    if (parsed) {
      // Show options close to the parsed value first
      return [...DURATION_OPTIONS].sort((a, b) => {
        const aDiff = Math.abs(a - parsed);
        const bDiff = Math.abs(b - parsed);
        return aDiff - bDiff;
      });
    }

    // Fallback: filter by label match
    const search = inputValue.toLowerCase();
    return DURATION_OPTIONS.filter((opt) => {
      const label = formatDuration(opt).toLowerCase();
      return label.includes(search);
    });
  }, [inputValue]);

  // Check if current input would parse to a valid duration not in the options
  const customDurationPreview = React.useMemo(() => {
    if (!inputValue.trim()) return null;
    const parsed = parseDurationInput(inputValue);
    if (!parsed || parsed <= 0 || parsed > 1440) return null;

    // Check if this exact duration is in the standard options
    const existsInOptions = DURATION_OPTIONS.includes(parsed);
    if (existsInOptions) return null;

    return {
      value: parsed,
      label: formatDuration(parsed),
    };
  }, [inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-between gap-2 px-3 h-10 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 cursor-pointer transition-colors",
            !duration && "text-gray-400",
            className
          )}
        >
          <span>{duration ? formatDuration(duration) : placeholder}</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" align="start">
        {/* Manual input at top */}
        <div className="p-2 border-b border-gray-200">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="90m, 1h30"
            className={cn(
              "w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              inputError ? "border-red-400 bg-red-50" : "border-gray-300"
            )}
          />
          {inputError && (
            <p className="text-xs text-red-500 mt-1">Invalid duration</p>
          )}
        </div>

        {/* Duration options list */}
        <div
          ref={listRef}
          className="max-h-[200px] overflow-y-auto py-1"
        >
          {/* Custom duration option */}
          {customDurationPreview && (
            <button
              type="button"
              onClick={() => handleSelectDuration(customDurationPreview.value)}
              className="w-full px-3 py-1.5 text-sm text-left bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors text-blue-700 border-b border-blue-100"
            >
              {customDurationPreview.label}
              <span className="text-blue-400 text-xs ml-2">↵ Enter</span>
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                data-value={opt}
                onClick={() => handleSelectDuration(opt)}
                className={cn(
                  "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 cursor-pointer transition-colors",
                  duration === opt && "bg-gray-900 text-white hover:bg-gray-800"
                )}
              >
                {formatDuration(opt)}
              </button>
            ))
          ) : !customDurationPreview ? (
            <p className="px-3 py-2 text-sm text-gray-400">No matching durations</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
