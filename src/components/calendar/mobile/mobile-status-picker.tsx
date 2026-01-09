"use client";

import { Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileStatusPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onStatusSelect: (status: string) => void;
  isLoading?: boolean;
}

const statuses = [
  {
    value: "PENDING",
    label: "Awaiting Confirmation",
    description: "Waiting for client confirmation",
    color: "bg-amber-500",
  },
  {
    value: "CONFIRMED",
    label: "Confirmed",
    description: "Client has confirmed",
    color: "bg-green-500",
  },
  {
    value: "CHECKED_IN",
    label: "Checked In",
    description: "Client has arrived",
    color: "bg-blue-500",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    description: "Service is being performed",
    color: "bg-blue-600",
  },
  {
    value: "COMPLETED",
    label: "Completed",
    description: "Service finished",
    color: "bg-gray-500",
  },
];

export function MobileStatusPicker({
  open,
  onOpenChange,
  currentStatus,
  onStatusSelect,
  isLoading,
}: MobileStatusPickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Change Status</SheetTitle>
        <SheetDescription className="sr-only">
          Select a new status for the appointment
        </SheetDescription>

        <div className="p-4">
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

          <h3 className="text-lg font-semibold text-center mb-4">Change Status</h3>

          <div className="space-y-2">
            {statuses.map((status) => {
              const isSelected = currentStatus === status.value;
              return (
                <button
                  key={status.value}
                  onClick={() => !isLoading && onStatusSelect(status.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-xl transition-colors",
                    "min-h-[60px]",
                    isSelected
                      ? "bg-gray-100 ring-2 ring-blue-500"
                      : "bg-gray-50 active:bg-gray-100"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", status.color)} />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{status.label}</div>
                    <div className="text-sm text-gray-500">{status.description}</div>
                  </div>
                  {isSelected && !isLoading && (
                    <Check className="h-5 w-5 text-blue-600" />
                  )}
                  {isSelected && isLoading && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Safe area padding */}
          <div style={{ height: "max(16px, env(safe-area-inset-bottom))" }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
