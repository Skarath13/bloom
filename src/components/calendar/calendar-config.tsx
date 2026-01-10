"use client";

import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";

// Zoom constraints
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.5;
const DEFAULT_ZOOM = 1.0;

/**
 * Calendar configuration that adapts to mobile/desktop viewport
 * Provides responsive values for grid dimensions and UI toggles
 */
export interface CalendarConfig {
  // Grid dimensions (dynamic based on zoom on mobile)
  PIXELS_PER_HOUR: number;
  PIXELS_PER_15_MIN: number;
  TIME_COLUMN_WIDTH: number;
  HEADER_HEIGHT: number;

  // UI toggles
  showSparkles: boolean;
  isMobile: boolean;

  // Derived values
  CALENDAR_START_HOUR: number;
  CALENDAR_END_HOUR: number;

  // Zoom control (mobile only)
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}

const CalendarConfigContext = createContext<CalendarConfig | null>(null);

// Desktop configuration - original values
const DESKTOP_CONFIG: Omit<CalendarConfig, "isMobile"> = {
  PIXELS_PER_HOUR: 80,
  PIXELS_PER_15_MIN: 20,
  TIME_COLUMN_WIDTH: 56,
  HEADER_HEIGHT: 37,
  showSparkles: true,
  CALENDAR_START_HOUR: 0,
  CALENDAR_END_HOUR: 24,
};

// Mobile configuration - compact for iPhone 14 Pro Max (430px)
// Time column: 38px leaves 392px for tech columns
// With 6 techs: 65px each | With 8 techs: 49px each
const MOBILE_CONFIG: Omit<CalendarConfig, "isMobile"> = {
  PIXELS_PER_HOUR: 72, // Slightly zoomed in to show appointments better
  PIXELS_PER_15_MIN: 18, // Proportional (72/4)
  TIME_COLUMN_WIDTH: 38, // Compact width, whitespace-nowrap prevents wrapping
  HEADER_HEIGHT: 30, // Smaller header
  showSparkles: false, // Remove decorative icons
  CALENDAR_START_HOUR: 0,
  CALENDAR_END_HOUR: 24,
};

interface CalendarConfigProviderProps {
  children: ReactNode;
}

export function CalendarConfigProvider({ children }: CalendarConfigProviderProps) {
  const isMobile = useIsMobile();

  // Zoom state with localStorage persistence (mobile only)
  const [zoomLevel, setZoomLevelState] = useState<number>(() => {
    if (typeof window !== 'undefined' && isMobile) {
      const saved = localStorage.getItem('calendar-zoom');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
          return parsed;
        }
      }
    }
    return DEFAULT_ZOOM;
  });

  // Persist zoom level to localStorage
  useEffect(() => {
    if (isMobile && typeof window !== 'undefined') {
      localStorage.setItem('calendar-zoom', zoomLevel.toString());
    }
  }, [zoomLevel, isMobile]);

  // Constrained zoom setter
  const setZoomLevel = (level: number) => {
    const constrained = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
    setZoomLevelState(constrained);
  };

  const config = useMemo<CalendarConfig>(() => {
    const baseConfig = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;

    // Apply zoom multiplier on mobile
    const effectiveZoom = isMobile ? zoomLevel : 1.0;
    const PIXELS_PER_HOUR = Math.round(baseConfig.PIXELS_PER_HOUR * effectiveZoom);
    const PIXELS_PER_15_MIN = Math.round(PIXELS_PER_HOUR / 4);

    return {
      ...baseConfig,
      PIXELS_PER_HOUR,
      PIXELS_PER_15_MIN,
      isMobile,
      zoomLevel: effectiveZoom,
      setZoomLevel,
    };
  }, [isMobile, zoomLevel]);

  return (
    <CalendarConfigContext.Provider value={config}>
      {children}
    </CalendarConfigContext.Provider>
  );
}

/**
 * Hook to access calendar configuration
 * Falls back to desktop config if used outside provider
 */
export function useCalendarConfig(): CalendarConfig {
  const context = useContext(CalendarConfigContext);

  if (!context) {
    // Fallback to desktop config if used outside provider
    // This allows components to be used in isolation for testing
    return {
      ...DESKTOP_CONFIG,
      isMobile: false,
      zoomLevel: DEFAULT_ZOOM,
      setZoomLevel: () => {},
    };
  }

  return context;
}

// Export constants for use outside React components (e.g., in utilities)
export const DESKTOP_CALENDAR_CONFIG = {
  ...DESKTOP_CONFIG,
  isMobile: false,
  zoomLevel: DEFAULT_ZOOM,
  setZoomLevel: () => {},
};
export const MOBILE_CALENDAR_CONFIG = {
  ...MOBILE_CONFIG,
  isMobile: true,
  zoomLevel: DEFAULT_ZOOM,
  setZoomLevel: () => {},
};
