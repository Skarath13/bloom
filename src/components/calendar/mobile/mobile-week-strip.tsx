"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday, isSameWeek } from "date-fns";
import { cn } from "@/lib/utils";

interface MobileWeekStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

// Calculate week width based on viewport (7 days * ~52px each + padding)
const WEEK_WIDTH = 375; // Will be calculated dynamically

export function MobileWeekStrip({ selectedDate, onDateSelect }: MobileWeekStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState<Date[]>(() => {
    // Initialize with 3 weeks: previous, current, next
    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return [
      subWeeks(currentWeekStart, 1),
      currentWeekStart,
      addWeeks(currentWeekStart, 1),
    ];
  });
  const [weekWidth, setWeekWidth] = useState(WEEK_WIDTH);
  const isScrollingRef = useRef(false);
  const lastSelectedWeekRef = useRef(startOfWeek(selectedDate, { weekStartsOn: 0 }));

  // Calculate actual week width on mount
  useEffect(() => {
    if (scrollRef.current) {
      setWeekWidth(scrollRef.current.offsetWidth);
    }
  }, []);

  // Scroll to the week containing the selected date
  useEffect(() => {
    if (!scrollRef.current || isScrollingRef.current) return;

    const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });

    // Check if we need to add weeks to reach the selected date
    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];

    if (selectedWeekStart < firstWeek) {
      // Need to add weeks at the beginning
      const weeksToAdd: Date[] = [];
      let week = subWeeks(firstWeek, 1);
      while (week >= selectedWeekStart) {
        weeksToAdd.unshift(week);
        week = subWeeks(week, 1);
      }
      if (weeksToAdd.length > 0) {
        setWeeks(prev => [...weeksToAdd, ...prev]);
      }
    } else if (selectedWeekStart > lastWeek) {
      // Need to add weeks at the end
      const weeksToAdd: Date[] = [];
      let week = addWeeks(lastWeek, 1);
      while (week <= selectedWeekStart) {
        weeksToAdd.push(week);
        week = addWeeks(week, 1);
      }
      if (weeksToAdd.length > 0) {
        setWeeks(prev => [...prev, ...weeksToAdd]);
      }
    }

    // Find index and scroll to it
    const weekIndex = weeks.findIndex(w => isSameWeek(w, selectedWeekStart, { weekStartsOn: 0 }));
    if (weekIndex !== -1) {
      const scrollPosition = weekIndex * weekWidth;
      scrollRef.current.scrollTo({ left: scrollPosition, behavior: "instant" });
    }

    lastSelectedWeekRef.current = selectedWeekStart;
  }, [selectedDate, weeks, weekWidth]);

  // Handle scroll to load more weeks
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;

    // Load more weeks when near the edges
    if (scrollLeft < weekWidth * 0.5) {
      // Near the start - add a week at the beginning
      setWeeks(prev => {
        const newWeek = subWeeks(prev[0], 1);
        return [newWeek, ...prev];
      });
      // Adjust scroll position to maintain visual position
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft += weekWidth;
        }
      });
    } else if (scrollLeft > maxScroll - weekWidth * 0.5) {
      // Near the end - add a week at the end
      setWeeks(prev => {
        const newWeek = addWeeks(prev[prev.length - 1], 1);
        return [...prev, newWeek];
      });
    }
  }, [weekWidth]);

  // Handle snap end to update selected date to the visible week's same day
  const handleScrollEnd = useCallback(() => {
    if (!scrollRef.current) return;

    isScrollingRef.current = false;

    const { scrollLeft } = scrollRef.current;
    const weekIndex = Math.round(scrollLeft / weekWidth);

    if (weekIndex >= 0 && weekIndex < weeks.length) {
      const visibleWeekStart = weeks[weekIndex];
      const dayOfWeek = selectedDate.getDay();
      const newDate = addDays(visibleWeekStart, dayOfWeek);

      // Only update if we've actually swiped to a different week
      if (!isSameWeek(newDate, selectedDate, { weekStartsOn: 0 })) {
        onDateSelect(newDate);
      }
    }
  }, [weeks, weekWidth, selectedDate, onDateSelect]);

  // Debounced scroll end detection
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let scrollTimeout: NodeJS.Timeout;

    const onScroll = () => {
      isScrollingRef.current = true;
      handleScroll();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScrollEnd, 150);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll, handleScrollEnd]);

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Fixed day labels */}
      <div className="flex justify-around py-2 px-1 border-b border-gray-100">
        {weekDayLabels.map((label, index) => (
          <div
            key={index}
            className="min-w-[44px] text-center text-xs font-medium text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Scrollable weeks */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        <div className="flex" style={{ width: `${weeks.length * 100}%` }}>
          {weeks.map((weekStart) => (
            <WeekRow
              key={weekStart.toISOString()}
              weekStart={weekStart}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              width={weekWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface WeekRowProps {
  weekStart: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  width: number;
}

function WeekRow({ weekStart, selectedDate, onDateSelect, width }: WeekRowProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div
      className="flex justify-around py-2 px-1 flex-shrink-0"
      style={{
        width: `${width}px`,
        scrollSnapAlign: "start",
        scrollSnapStop: "always", // Force stop at each week - no flinging past
      }}
    >
      {weekDays.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);

        return (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors",
              "active:bg-gray-100"
            )}
          >
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
  );
}
