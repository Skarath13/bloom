"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface TimeIndicatorProps {
  // The hour the calendar starts at (e.g., 0 for midnight)
  startHour: number;
  // Pixels per hour
  pixelsPerHour: number;
  // Left offset (for time column width)
  leftOffset: number;
}

// Format time for the indicator badge
const formatCurrentTime = (date: Date) => {
  return format(date, "h:mm a");
};

export function TimeIndicator({
  startHour,
  pixelsPerHour,
  leftOffset,
}: TimeIndicatorProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initialize time only on client to avoid hydration mismatch
    setCurrentTime(new Date());
    setMounted(true);

    // Update every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Don't render until mounted to avoid hydration issues
  if (!mounted || !currentTime) {
    return null;
  }

  // Calculate position from the top
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const totalMinutes = (hours - startHour) * 60 + minutes;
  const topPosition = (totalMinutes / 60) * pixelsPerHour;

  // Don't show if outside calendar range
  if (hours < startHour || topPosition < 0) {
    return null;
  }

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        top: `${topPosition}px`,
        left: 0,
        right: 0,
      }}
    >
      {/* Time badge in the time column */}
      <div
        className="absolute bg-red-500 text-white text-[10px] font-semibold px-1 py-0.5 rounded-sm whitespace-nowrap shadow-sm"
        style={{
          left: "2px",
          top: "-8px",
        }}
      >
        {formatCurrentTime(currentTime)}
      </div>

      {/* Red triangle marker pointing right */}
      <div
        className="absolute"
        style={{
          left: `${leftOffset - 6}px`,
          top: "-4px",
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderLeft: "6px solid #EF4444",
        }}
      />

      {/* Red line - slightly overlaps triangle for seamless connection */}
      <div
        className="absolute h-[2px] bg-red-500"
        style={{
          left: `${leftOffset - 1}px`,
          right: 0,
          top: "-1px",
        }}
      />
    </div>
  );
}

// Export helper to get current time position for scrolling
export function getCurrentTimeScrollPosition(
  startHour: number,
  pixelsPerHour: number,
  viewportHeight: number
): number {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = (hours - startHour) * 60 + minutes;
  const currentPosition = (totalMinutes / 60) * pixelsPerHour;

  // Position current time at top quarter of viewport
  const targetOffset = viewportHeight / 4;
  return Math.max(0, currentPosition - targetOffset);
}
