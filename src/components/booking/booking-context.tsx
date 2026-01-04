"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface BookingState {
  locationId: string | null;
  locationName: string | null;
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

interface BookingContextType {
  state: BookingState;
  setLocation: (id: string, name: string) => void;
  setService: (id: string, name: string, price: number, duration: number, deposit: number) => void;
  setTechnician: (id: string | null, name: string | null, isAny: boolean) => void;
  setDateTime: (date: Date, time: string) => void;
  setClientInfo: (firstName: string, lastName: string, phone: string, email: string, notes: string) => void;
  resetBooking: () => void;
}

const initialState: BookingState = {
  locationId: null,
  locationName: null,
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

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);

  const setLocation = (id: string, name: string) => {
    setState((prev) => ({ ...prev, locationId: id, locationName: name }));
  };

  const setService = (id: string, name: string, price: number, duration: number, deposit: number) => {
    setState((prev) => ({
      ...prev,
      serviceId: id,
      serviceName: name,
      servicePrice: price,
      serviceDuration: duration,
      depositAmount: deposit,
    }));
  };

  const setTechnician = (id: string | null, name: string | null, isAny: boolean) => {
    setState((prev) => ({
      ...prev,
      technicianId: id,
      technicianName: name,
      isAnyTechnician: isAny,
    }));
  };

  const setDateTime = (date: Date, time: string) => {
    setState((prev) => ({ ...prev, selectedDate: date, selectedTime: time }));
  };

  const setClientInfo = (firstName: string, lastName: string, phone: string, email: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      clientFirstName: firstName,
      clientLastName: lastName,
      clientPhone: phone,
      clientEmail: email,
      notes,
    }));
  };

  const resetBooking = () => {
    setState(initialState);
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
