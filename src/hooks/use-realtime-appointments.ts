"use client";

import { useEffect } from "react";
import { supabase, tables } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeAppointmentsOptions {
  locationId: string;
  onInsert?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
  onChange?: () => void;
}

export function useRealtimeAppointments({
  locationId,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeAppointmentsOptions) {
  useEffect(() => {
    if (!locationId) return;

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`calendar-${locationId}`)
        // Appointments
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "appointments",
            table: tables.appointments,
            filter: `locationId=eq.${locationId}`,
          },
          () => {
            onInsert?.();
            onChange?.();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "appointments",
            table: tables.appointments,
            filter: `locationId=eq.${locationId}`,
          },
          () => {
            onUpdate?.();
            onChange?.();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "appointments",
            table: tables.appointments,
          },
          () => {
            onDelete?.();
            onChange?.();
          }
        )
        // Technician blocks (personal events)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "appointments",
            table: tables.technicianBlocks,
          },
          () => {
            onInsert?.();
            onChange?.();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "appointments",
            table: tables.technicianBlocks,
          },
          () => {
            onUpdate?.();
            onChange?.();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "appointments",
            table: tables.technicianBlocks,
          },
          () => {
            onDelete?.();
            onChange?.();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [locationId, onInsert, onUpdate, onDelete, onChange]);
}
