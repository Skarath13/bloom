"use client";

import * as React from "react";
import { X, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";

interface OperatingHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface HoursEditingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (hours: OperatingHours[]) => Promise<void>;
  locationName: string;
  initialHours: OperatingHours[];
  saving?: boolean;
}

const daysOfWeek = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Format time for display (24h to 12h)
const formatTimeDisplay = (time: string): string => {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "am" : "pm";
  return `${hour12}:${minute} ${ampm}`;
};

export function HoursEditingModal({
  open,
  onClose,
  onSave,
  locationName,
  initialHours,
  saving = false,
}: HoursEditingModalProps) {
  const [hours, setHours] = React.useState<OperatingHours[]>(initialHours);
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset hours when modal opens with new data
  React.useEffect(() => {
    if (open) {
      setHours(initialHours);
    }
  }, [open, initialHours]);

  const isProcessing = saving || isSaving;

  const handleToggleDay = (dayOfWeek: number, isOpen: boolean) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, isOpen } : h))
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: "openTime" | "closeTime",
    value: string
  ) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  };

  // Calculate changes from initial
  const getChanges = (): { day: string; change: string }[] => {
    const changes: { day: string; change: string }[] = [];

    hours.forEach((h) => {
      const initial = initialHours.find((i) => i.dayOfWeek === h.dayOfWeek);
      if (!initial) return;

      const dayLabel = daysOfWeek.find((d) => d.value === h.dayOfWeek)?.label || "";

      if (initial.isOpen !== h.isOpen) {
        if (h.isOpen) {
          changes.push({
            day: dayLabel,
            change: `Now OPEN ${formatTimeDisplay(h.openTime)} - ${formatTimeDisplay(h.closeTime)} (was Closed)`,
          });
        } else {
          changes.push({
            day: dayLabel,
            change: `Now CLOSED (was ${formatTimeDisplay(initial.openTime)} - ${formatTimeDisplay(initial.closeTime)})`,
          });
        }
      } else if (h.isOpen && (initial.openTime !== h.openTime || initial.closeTime !== h.closeTime)) {
        changes.push({
          day: dayLabel,
          change: `Hours changed to ${formatTimeDisplay(h.openTime)} - ${formatTimeDisplay(h.closeTime)}`,
        });
      }
    });

    return changes;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(hours);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const changes = getChanges();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Operating Hours - {locationName}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Schedule */}
          <div className="mb-4">
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {hours
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((day) => {
                  const dayInfo = daysOfWeek.find((d) => d.value === day.dayOfWeek);
                  return (
                    <div
                      key={day.dayOfWeek}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3",
                        !day.isOpen && "bg-gray-50"
                      )}
                    >
                      <span className="w-24 text-sm font-medium text-gray-900">
                        {dayInfo?.label}
                      </span>
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) =>
                          handleToggleDay(day.dayOfWeek, checked)
                        }
                      />
                      {day.isOpen ? (
                        <div className="flex items-center gap-2 text-sm">
                          <TimePicker
                            time={day.openTime}
                            onTimeChange={(time) =>
                              handleTimeChange(day.dayOfWeek, "openTime", time)
                            }
                            interval={30}
                            className="px-2 py-1 border border-gray-300 rounded-md bg-white"
                          />
                          <span className="text-gray-500">to</span>
                          <TimePicker
                            time={day.closeTime}
                            onTimeChange={(time) =>
                              handleTimeChange(day.dayOfWeek, "closeTime", time)
                            }
                            interval={30}
                            className="px-2 py-1 border border-gray-300 rounded-md bg-white"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Closed</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Changes Preview */}
          {changes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Changes
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {changes.map((change, index) => (
                  <p key={index} className="text-sm text-amber-800">
                    <span className="font-medium">{change.day}:</span> {change.change}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <p className="text-xs text-gray-500">
            Note: Last appointment slot is typically 1 hour before closing time.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer border border-gray-300 hover:bg-gray-100 active:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] flex items-center justify-center"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save Hours"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
