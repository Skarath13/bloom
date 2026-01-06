"use client";

import { Check, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ViewRange = "day" | "week" | "month";

interface CalendarSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  viewRange: ViewRange;
  onViewRangeChange: (range: ViewRange) => void;
  selectedStaffCount: number;
}

const VIEW_RANGE_OPTIONS: { value: ViewRange; label: string; description: string }[] = [
  { value: "day", label: "Day", description: "View one day at a time" },
  { value: "week", label: "Week", description: "View a full week (single staff only)" },
  { value: "month", label: "Month", description: "View a full month (single staff only)" },
];

export function CalendarSettingsDialog({
  open,
  onClose,
  viewRange,
  onViewRangeChange,
  selectedStaffCount,
}: CalendarSettingsDialogProps) {
  const isSingleStaff = selectedStaffCount === 1;

  const handleRangeSelect = (range: ViewRange) => {
    // Week and Month views only work with single staff
    if ((range === "week" || range === "month") && !isSingleStaff) {
      return;
    }
    onViewRangeChange(range);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* View Range Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">View Range</h3>

            {/* Info message for multi-staff */}
            {!isSingleStaff && (
              <div className="flex items-start gap-2 p-3 mb-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Week and Month views are only available when viewing a single staff member.
                  Select one staff member in the sidebar to enable these options.
                </span>
              </div>
            )}

            <div className="space-y-2">
              {VIEW_RANGE_OPTIONS.map((option) => {
                const isDisabled = (option.value === "week" || option.value === "month") && !isSingleStaff;
                const isSelected = viewRange === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => handleRangeSelect(option.value)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                      isSelected
                        ? "border-[#1E1B4B] bg-[#1E1B4B]/5"
                        : "border-gray-200 hover:border-gray-300",
                      isDisabled && "opacity-50 cursor-not-allowed hover:border-gray-200"
                    )}
                  >
                    <div className="text-left">
                      <div className={cn(
                        "font-medium",
                        isSelected ? "text-[#1E1B4B]" : "text-gray-900"
                      )}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#1E1B4B] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
