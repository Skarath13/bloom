"use client";

import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface MobileWeekStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function MobileWeekStrip({ selectedDate, onDateSelect }: MobileWeekStripProps) {
  // Get the start of the week containing the selected date (Sunday)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });

  // Generate the 7 days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white border-b border-gray-200 py-2 px-1">
      <div className="flex justify-around">
        {weekDays.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[44px] min-h-[56px] py-1 rounded-lg transition-colors",
                "active:bg-gray-100"
              )}
            >
              {/* Day label (S, M, T, etc.) */}
              <span className={cn(
                "text-xs font-medium",
                isSelected ? "text-gray-900" : "text-gray-500"
              )}>
                {weekDayLabels[index]}
              </span>

              {/* Date number */}
              <div
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isSelected && "bg-gray-900 text-white",
                  !isSelected && isTodayDate && "ring-2 ring-inset ring-gray-900 text-gray-900",
                  !isSelected && !isTodayDate && "text-gray-700"
                )}
              >
                {format(day, "d")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
