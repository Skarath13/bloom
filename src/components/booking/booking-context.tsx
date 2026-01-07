"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const STORAGE_KEY = "bloom_booking_state";
const STORAGE_EXPIRY_HOURS = 24;

interface BookingState {
  locationId: string | null;
  locationName: string | null;
  locationSlug: string | null;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  serviceDuration: number | null;
  depositAmount: number | null;
  technicianId: string | null;
  technicianName: string | null;
  isAnyTechnician: boolean;
  selectedDate: Date | null;
  selectedTime: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientEmail: string;
  notes: string;
}

interface StoredBookingState extends Omit<BookingState, "selectedDate"> {
  selectedDate: string | null;
  timestamp: number;
}

interface BookingContextType {
  state: BookingState;
  setLocation: (id: string, name: string, slug: string) => void;
  setService: (id: string, name: string, price: number, duration: number, deposit: number) => void;
  setTechnician: (id: string | null, name: string | null, isAny: boolean) => void;
  setDateTime: (date: Date, time: string) => void;
  setClientInfo: (firstName: string, lastName: string, phone: string, email: string, notes: string) => void;
  resetBooking: () => void;
  getCurrentStep: () => number;
  getResumeUrl: () => string | null;
}

const initialState: BookingState = {
  locationId: null,
  locationName: null,
  locationSlug: null,
  serviceId: null,
  serviceName: null,
  servicePrice: null,
  serviceDuration: null,
  depositAmount: null,
  technicianId: null,
  technicianName: null,
  isAnyTechnician: false,
  selectedDate: null,
  selectedTime: null,
  clientFirstName: "",
  clientLastName: "",
  clientPhone: "",
  clientEmail: "",
  notes: "",
};

// Load state from localStorage
function loadStoredState(): BookingState {
  if (typeof window === "undefined") return initialState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;

    const parsed: StoredBookingState = JSON.parse(stored);

    // Check if expired (24 hours)
    const hoursSinceStored = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
    if (hoursSinceStored > STORAGE_EXPIRY_HOURS) {
      localStorage.removeItem(STORAGE_KEY);
      return initialState;
    }

    return {
      ...parsed,
      selectedDate: parsed.selectedDate ? new Date(parsed.selectedDate) : null,
    };
  } catch {
    return initialState;
  }
}

// Save state to localStorage
function saveState(state: BookingState): void {
  if (typeof window === "undefined") return;

  const toStore: StoredBookingState = {
    ...state,
    selectedDate: state.selectedDate?.toISOString() || null,
    timestamp: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedState = loadStoredState();
    setState(storedState);
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on state changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveState(state);
    }
  }, [state, isHydrated]);

  const setLocation = useCallback((id: string, name: string, slug: string) => {
    setState((prev) => ({ ...prev, locationId: id, locationName: name, locationSlug: slug }));
  }, []);

  const setService = useCallback((id: string, name: string, price: number, duration: number, deposit: number) => {
    setState((prev) => ({
      ...prev,
      serviceId: id,
      serviceName: name,
      servicePrice: price,
      serviceDuration: duration,
      depositAmount: deposit,
    }));
  }, []);

  const setTechnician = useCallback((id: string | null, name: string | null, isAny: boolean) => {
    setState((prev) => ({
      ...prev,
      technicianId: id,
      technicianName: name,
      isAnyTechnician: isAny,
    }));
  }, []);

  const setDateTime = useCallback((date: Date, time: string) => {
    setState((prev) => ({ ...prev, selectedDate: date, selectedTime: time }));
  }, []);

  const setClientInfo = useCallback((firstName: string, lastName: string, phone: string, email: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      clientFirstName: firstName,
      clientLastName: lastName,
      clientPhone: phone,
      clientEmail: email,
      notes,
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(initialState);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Calculate current step based on state
  const getCurrentStep = (): number => {
    if (!state.locationId) return 1;
    if (!state.serviceId) return 2;
    if (!state.technicianId && !state.isAnyTechnician) return 3;
    if (!state.selectedDate || !state.selectedTime) return 4;
    return 5;
  };

  // Get URL to resume booking from current progress
  const getResumeUrl = (): string | null => {
    if (!state.locationSlug) return null;

    const step = getCurrentStep();
    switch (step) {
      case 2:
        return `/book/${state.locationSlug}`;
      case 3:
        return `/book/${state.locationSlug}/${state.serviceId}`;
      case 4:
      case 5:
        const techId = state.isAnyTechnician ? "any" : state.technicianId;
        if (step === 4) {
          return `/book/${state.locationSlug}/${state.serviceId}/${techId}`;
        }
        return `/book/${state.locationSlug}/${state.serviceId}/${techId}/checkout`;
      default:
        return null;
    }
  };

  return (
    <BookingContext.Provider
      value={{
        state,
        setLocation,
        setService,
        setTechnician,
        setDateTime,
        setClientInfo,
        resetBooking,
        getCurrentStep,
        getResumeUrl,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
