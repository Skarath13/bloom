"use client";

import { useMemo, useRef, useEffect } from "react";
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
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileDatePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

// Generate months from 6 months ago to 18 months ahead
function generateMonths(baseDate: Date): Date[] {
  const months: Date[] = [];
  const start = subMonths(startOfMonth(baseDate), 6);

  for (let i = 0; i < 24; i++) {
    months.push(addMonths(start, i));
  }

  return months;
}

export function MobileDatePickerSheet({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
}: MobileDatePickerSheetProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayMonthRef = useRef<HTMLDivElement>(null);

  // Generate months fresh - 6 months back, 18 months forward from TODAY
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const months = useMemo(() => generateMonths(new Date()), [open]); // Regenerate when opened

  // Scroll to current month when sheet opens
  useEffect(() => {
    if (open) {
      // Wait for sheet animation to complete, then scroll
      const timer = setTimeout(() => {
        if (todayMonthRef.current && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const monthEl = todayMonthRef.current;

          // Get actual positions using getBoundingClientRect
          const containerRect = container.getBoundingClientRect();
          const monthRect = monthEl.getBoundingClientRect();

          // Calculate how much to scroll: current scroll + difference in tops
          const scrollTo = container.scrollTop + (monthRect.top - containerRect.top);
          container.scrollTop = scrollTo;
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
    onOpenChange(false);
  };

  const handleTodayClick = () => {
    onDateSelect(new Date());
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden"
        style={{ height: "100dvh" }}
      >
        {/* Accessibility (visually hidden) */}
        <SheetTitle className="sr-only">Select a Day</SheetTitle>
        <SheetDescription className="sr-only">
          Choose a date from the calendar to navigate to that day
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold">
            Select a Day
          </h1>
          <Button
            variant="ghost"
            className="text-blue-600 font-semibold min-h-[44px] min-w-[44px] -mr-2"
            onClick={handleTodayClick}
          >
            Today
          </Button>
        </div>

        {/* Sticky week header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="grid grid-cols-7 py-2">
            {weekDayLabels.map((label, index) => (
              <div
                key={index}
                className="text-center text-xs font-medium text-gray-500"
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable months */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {months.map((month) => {
            // Scroll to current month (today), not the selected date's month
            const isTodayMonth = isSameMonth(month, new Date());

            return (
              <MonthGrid
                key={month.toISOString()}
                month={month}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                ref={isTodayMonth ? todayMonthRef : undefined}
              />
            );
          })}
          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MonthGridProps {
  month: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

import { forwardRef } from "react";

const MonthGrid = forwardRef<HTMLDivElement, MonthGridProps>(
  function MonthGrid({ month, selectedDate, onDateSelect }, ref) {
    // Generate calendar days for this month
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div ref={ref} className="px-4 py-4">
        {/* Month label */}
        <h3 className="text-center text-base font-semibold text-gray-900 mb-3">
          {format(month, "MMMM yyyy")}
        </h3>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((dayDate, index) => {
            const isCurrentMonth = isSameMonth(dayDate, month);
            const isSelected = isSameDay(dayDate, selectedDate);
            const isTodayDate = isToday(dayDate);

            // Don't render days from other months
            if (!isCurrentMonth) {
              return <div key={index} className="h-11" />;
            }

            return (
              <button
                key={index}
                onClick={() => onDateSelect(dayDate)}
                className={cn(
                  "h-11 flex items-center justify-center text-sm rounded-full mx-auto transition-colors",
                  "w-11 min-w-[44px] min-h-[44px]", // Touch target
                  "active:bg-gray-100",
                  isSelected && "bg-gray-900 text-white",
                  !isSelected && isTodayDate && "ring-2 ring-inset ring-gray-900 text-gray-900 font-semibold",
                  !isSelected && !isTodayDate && "text-gray-700"
                )}
              >
                {format(dayDate, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
