"use client";

import { useEffect } from "react";
import { supabase, tables } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeTechniciansOptions {
  locationId: string;
  onChange?: () => void;
}

export function useRealtimeTechnicians({
  locationId,
  onChange,
}: UseRealtimeTechniciansOptions) {
  useEffect(() => {
    if (!locationId) return;

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`technicians-${locationId}`)
        // Listen for technician changes
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "appointments",
            table: tables.technicians,
            filter: `locationId=eq.${locationId}`,
          },
          () => {
            console.log("Technician changed");
            onChange?.();
          }
        )
        // Listen for schedule changes (no filter - schedules don't have locationId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "appointments",
            table: tables.technicianSchedules,
          },
          () => {
            console.log("Technician schedule changed");
            onChange?.();
          }
        )
        .subscribe((status) => {
          console.log("Technicians realtime subscription status:", status);
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [locationId, onChange]);
}
