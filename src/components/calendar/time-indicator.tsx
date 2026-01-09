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
      className="absolute pointer-events-none"
      style={{
        top: `${topPosition}px`,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      {/* Red line - desktop: starts after time column */}
      <div
        className="absolute h-[2px] bg-red-500 -translate-y-1/2 hidden sm:block"
        style={{
          left: `${leftOffset - 8}px`,
          right: 0,
          top: 0,
          zIndex: 1,
        }}
      />
      {/* Red line - mobile: full width */}
      <div
        className="absolute h-[2px] bg-red-500 -translate-y-1/2 sm:hidden"
        style={{
          left: 0,
          right: 0,
          top: 0,
          zIndex: 1,
        }}
      />

      {/* Time badge - hidden on mobile, shown on desktop */}
      <div
        className="absolute hidden sm:flex items-center justify-center -translate-y-1/2 overflow-hidden"
        style={{
          left: 2,
          width: `${leftOffset - 4}px`,
          top: 0,
          zIndex: 2,
        }}
      >
        <div className="bg-red-500 text-white text-[9px] font-semibold px-1 py-0.5 rounded whitespace-nowrap shadow-sm">
          {formatCurrentTime(currentTime)}
        </div>
      </div>
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
