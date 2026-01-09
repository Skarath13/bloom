"use client";

import { format } from "date-fns";
import { CalendarCheck, Lock, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type EventType = "appointment" | "personal_event";

interface MobileEventTypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianName: string;
  time: Date;
  onSelect: (type: EventType) => void;
}

export function MobileEventTypeSheet({
  open,
  onOpenChange,
  technicianName,
  time,
  onSelect,
}: MobileEventTypeSheetProps) {
  const handleSelect = (type: EventType) => {
    onSelect(type);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 [&>button]:hidden"
        style={{ height: "auto", maxHeight: "50dvh" }}
      >
        <SheetTitle className="sr-only">Create Event</SheetTitle>
        <SheetDescription className="sr-only">
          Choose whether to create an appointment or personal event
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200">
          <button
            onClick={() => onOpenChange(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-base font-semibold text-gray-900">Create Event</h2>
            <p className="text-xs text-gray-500">
              {technicianName} · {format(time, "h:mm a")}
            </p>
          </div>
          <div className="w-[44px]" /> {/* Spacer for alignment */}
        </div>

        {/* Options */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => handleSelect("appointment")}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "border border-gray-200 bg-white",
              "active:bg-gray-50 transition-colors",
              "min-h-[72px]"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">Appointment</p>
              <p className="text-sm text-gray-500">Book a client</p>
            </div>
          </button>

          <button
            onClick={() => handleSelect("personal_event")}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "border border-gray-200 bg-white",
              "active:bg-gray-50 transition-colors",
              "min-h-[72px]"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">Personal Event</p>
              <p className="text-sm text-gray-500">Block off time</p>
            </div>
          </button>
        </div>

        {/* Bottom safe area */}
        <div className="pb-safe" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </SheetContent>
    </Sheet>
  );
}
