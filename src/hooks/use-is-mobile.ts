"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect mobile viewport (< 768px)
 * Uses useSyncExternalStore for proper SSR hydration
 * Safari/WebKit compatible
 */
export function useIsMobile(): boolean {
  const subscribe = (callback: () => void) => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  };

  const getSnapshot = () => {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  };

  const getServerSnapshot = () => {
    // Default to false (desktop) on server - this is a reasonable default
    // since most admin users are on desktop
    return false;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
