"use client";

import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId?: string;
}

interface Location {
  id: string;
  name: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DaySchedule {
  isWorking: boolean;
  slots: TimeSlot[];
}

interface StaffScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  technicians: Technician[];
  locations: Location[];
  selectedLocationId: string;
  selectedDate: Date;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
  "9:00 PM", "9:30 PM", "10:00 PM"
];

const defaultSlot: TimeSlot = {
  startTime: "9:00 AM",
  endTime: "7:00 PM",
};

const getDefaultSchedule = (): Record<number, DaySchedule> => {
  const schedule: Record<number, DaySchedule> = {};
  for (let i = 0; i < 7; i++) {
    schedule[i] = {
      isWorking: i !== 0,
      slots: [{ ...defaultSlot }],
    };
  }
  return schedule;
};

export function StaffScheduleDialog({
  open,
  onClose,
  technicians,
  locations,
  selectedLocationId,
  selectedDate,
}: StaffScheduleDialogProps) {
  const [activeTab, setActiveTab] = useState<"one-time" | "recurring">("one-time");
  const [selectedTechId, setSelectedTechId] = useState<string>(technicians[0]?.id || "");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selectedDate, { weekStartsOn: 0 }));
  const [oneTimeSchedule, setOneTimeSchedule] = useState<Record<string, DaySchedule>>({});
  const [recurringSchedule, setRecurringSchedule] = useState<Record<number, DaySchedule>>(getDefaultSchedule);

  const selectedTech = technicians.find((t) => t.id === selectedTechId);
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  useEffect(() => {
    const newSchedule: Record<string, DaySchedule> = {};
    weekDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      if (!oneTimeSchedule[dateKey]) {
        const dayOfWeek = day.getDay();
        newSchedule[dateKey] = {
          isWorking: dayOfWeek !== 0,
          slots: [{ ...defaultSlot }],
        };
      }
    });
    if (Object.keys(newSchedule).length > 0) {
      setOneTimeSchedule((prev) => ({ ...prev, ...newSchedule }));
    }
  }, [weekStart]);

  const handlePrevWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const handleNextWeek = () => setWeekStart(addWeeks(weekStart, 1));

  const updateSchedule = (
    key: string | number,
    isOneTime: boolean,
    updates: Partial<DaySchedule>
  ) => {
    if (isOneTime) {
      setOneTimeSchedule((prev) => ({
        ...prev,
        [key]: { ...prev[key as string], ...updates },
      }));
    } else {
      setRecurringSchedule((prev) => ({
        ...prev,
        [key]: { ...prev[key as number], ...updates },
      }));
    }
  };

  const updateSlot = (
    key: string | number,
    isOneTime: boolean,
    slotIndex: number,
    updates: Partial<TimeSlot>
  ) => {
    const schedule = isOneTime ? oneTimeSchedule : recurringSchedule;
    const setSchedule = isOneTime ? setOneTimeSchedule : setRecurringSchedule;
    const daySchedule = schedule[key as keyof typeof schedule];

    setSchedule((prev: typeof schedule) => {
      const day = prev[key as keyof typeof prev];
      const newSlots = [...day.slots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], ...updates };
      return { ...prev, [key]: { ...day, slots: newSlots } };
    });
  };

  const addSlot = (key: string | number, isOneTime: boolean) => {
    if (isOneTime) {
      setOneTimeSchedule((prev) => {
        const day = prev[key as string];
        if (!day) return prev;
        return {
          ...prev,
          [key]: { ...day, slots: [...day.slots, { ...defaultSlot }] },
        };
      });
    } else {
      setRecurringSchedule((prev) => {
        const day = prev[key as number];
        if (!day) return prev;
        return {
          ...prev,
          [key]: { ...day, slots: [...day.slots, { ...defaultSlot }] },
        };
      });
    }
  };

  const removeSlot = (key: string | number, isOneTime: boolean, slotIndex: number) => {
    if (isOneTime) {
      setOneTimeSchedule((prev) => {
        const day = prev[key as string];
        if (!day || day.slots.length <= 1) return prev;
        return {
          ...prev,
          [key]: { ...day, slots: day.slots.filter((_: TimeSlot, i: number) => i !== slotIndex) },
        };
      });
    } else {
      setRecurringSchedule((prev) => {
        const day = prev[key as number];
        if (!day || day.slots.length <= 1) return prev;
        return {
          ...prev,
          [key]: { ...day, slots: day.slots.filter((_: TimeSlot, i: number) => i !== slotIndex) },
        };
      });
    }
  };

  const resetToWeeklySchedule = () => {
    const newSchedule: Record<string, DaySchedule> = {};
    weekDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayOfWeek = day.getDay();
      newSchedule[dateKey] = {
        ...recurringSchedule[dayOfWeek],
        slots: recurringSchedule[dayOfWeek].slots.map((s) => ({ ...s })),
      };
    });
    setOneTimeSchedule((prev) => ({ ...prev, ...newSchedule }));
  };

  const renderScheduleRow = (
    key: string | number,
    dayLabel: string,
    schedule: DaySchedule,
    isOneTime: boolean
  ) => {
    const { isWorking, slots } = schedule;

    return (
      <div key={key} className="grid grid-cols-[100px_1fr] gap-4 py-3 border-b border-gray-100 last:border-b-0">
        {/* Day column */}
        <div className="flex items-start pt-2">
          <button
            onClick={() => updateSchedule(key, isOneTime, { isWorking: !isWorking })}
            className={cn(
              "w-full text-left text-sm font-medium transition-colors",
              isWorking ? "text-gray-900" : "text-gray-400"
            )}
          >
            {dayLabel}
          </button>
        </div>

        {/* Time slots column */}
        <div className="space-y-2">
          {isWorking ? (
            slots.map((slot, slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-2">
                <Select
                  value={slot.startTime}
                  onValueChange={(v) => updateSlot(key, isOneTime, slotIndex, { startTime: v })}
                >
                  <SelectTrigger className="w-[110px] h-9 bg-white border-gray-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-gray-400 text-sm">to</span>

                <Select
                  value={slot.endTime}
                  onValueChange={(v) => updateSlot(key, isOneTime, slotIndex, { endTime: v })}
                >
                  <SelectTrigger className="w-[110px] h-9 bg-white border-gray-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0"
                  onClick={() => removeSlot(key, isOneTime, slotIndex)}
                  disabled={slots.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>

                {slotIndex === slots.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0"
                    onClick={() => addSlot(key, isOneTime)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-center h-9 text-sm text-gray-400">
              Not working
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden bg-white">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-white">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Edit availability
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white">
          <button
            className={cn(
              "px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors mr-6",
              activeTab === "one-time"
                ? "text-gray-900 border-gray-900"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
            onClick={() => setActiveTab("one-time")}
          >
            One-time change
          </button>
          <button
            className={cn(
              "px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "recurring"
                ? "text-gray-900 border-gray-900"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
            onClick={() => setActiveTab("recurring")}
          >
            Recurring schedule
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto bg-white">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-4">
            {activeTab === "one-time" && (
              <div className="flex items-center bg-gray-100 rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-gray-200 rounded-l-lg rounded-r-none"
                  onClick={handlePrevWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm font-medium text-gray-700 min-w-[140px] text-center">
                  {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-gray-200 rounded-r-lg rounded-l-none"
                  onClick={handleNextWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
              <SelectTrigger className="w-[220px] h-10 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2.5">
                  {selectedTech && (
                    <>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: selectedTech.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {selectedTech.firstName} {selectedTech.lastName}
                      </span>
                    </>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {technicians.map((tech) => (
                  <SelectItem
                    key={tech.id}
                    value={tech.id}
                    className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tech.color }}
                      />
                      <span className="text-sm">{tech.firstName} {tech.lastName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule grid */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            {activeTab === "one-time" ? (
              <>
                {weekDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const daySchedule = oneTimeSchedule[dateKey] || {
                    isWorking: day.getDay() !== 0,
                    slots: [{ ...defaultSlot }],
                  };
                  return renderScheduleRow(
                    dateKey,
                    format(day, "EEE, MMM d"),
                    daySchedule,
                    true
                  );
                })}

                <button
                  className="mt-4 text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  onClick={resetToWeeklySchedule}
                >
                  Reset to weekly schedule
                </button>
              </>
            ) : (
              WEEKDAYS_FULL.map((dayName, dayOfWeek) => {
                const daySchedule = recurringSchedule[dayOfWeek];
                return renderScheduleRow(
                  dayOfWeek,
                  dayName,
                  daySchedule,
                  false
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={onClose}
            className="px-4 bg-gray-900 hover:bg-gray-800 text-white"
          >
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
