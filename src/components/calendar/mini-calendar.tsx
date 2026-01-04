"use client";

import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="p-4">
        <div className="h-8 mb-4 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-8 w-8 mx-auto rounded-full bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button className="flex items-center gap-1 text-lg font-semibold hover:bg-gray-100 rounded px-2 py-1">
          {format(currentMonth, "MMM yyyy")}
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((weekDay) => (
          <div
            key={weekDay}
            className="text-center text-xs text-gray-500 font-medium py-1"
          >
            {weekDay}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((dayDate, index) => {
          const isCurrentMonth = isSameMonth(dayDate, currentMonth);
          const isSelected = isSameDay(dayDate, selectedDate);
          const isTodayDate = isToday(dayDate);

          return (
            <button
              key={index}
              className={cn(
                "h-8 w-8 flex items-center justify-center text-sm rounded-full mx-auto",
                "hover:bg-gray-100 transition-colors",
                !isCurrentMonth && "text-gray-300",
                isCurrentMonth && "text-gray-700",
                isSelected && "bg-gray-900 text-white hover:bg-gray-800",
                isTodayDate && !isSelected && "text-blue-600 font-semibold"
              )}
              onClick={() => onDateSelect(dayDate)}
            >
              {format(dayDate, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
