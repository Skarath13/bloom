"use client";

import { useState, useEffect } from "react";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { X, Loader2, Check, ChevronRight, Repeat } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMobileNav } from "@/contexts/mobile-nav-context";

interface MobileCreatePersonalEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianId: string;
  technicianName: string;
  locationId: string;
  time: Date;
  onSuccess: () => void;
}

interface RepetitionSettings {
  enabled: boolean;
  interval: number;
  frequency: "day" | "week" | "month";
  ends: "never" | "after" | "on_date";
  endAfterOccurrences?: number;
  endDate?: string;
}

// Generate time options (15-minute intervals)
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const date = new Date(2000, 0, 1, hour, minute);
      options.push({
        value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        label: format(date, "h:mm a").toLowerCase(),
      });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

function buildRecurrenceRule(settings: RepetitionSettings): string | null {
  if (!settings.enabled) return null;

  const freq = settings.frequency.toUpperCase();
  let rule = `FREQ=${freq};INTERVAL=${settings.interval}`;

  if (settings.ends === "after" && settings.endAfterOccurrences) {
    rule += `;COUNT=${settings.endAfterOccurrences}`;
  } else if (settings.ends === "on_date" && settings.endDate) {
    const untilDate = new Date(settings.endDate);
    rule += `;UNTIL=${format(untilDate, "yyyyMMdd")}T235959Z`;
  }

  return rule;
}

export function MobileCreatePersonalEventSheet({
  open,
  onOpenChange,
  technicianId,
  technicianName,
  locationId,
  time,
  onSuccess,
}: MobileCreatePersonalEventSheetProps) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState<Date>(time);
  const [startTime, setStartTime] = useState(format(time, "HH:mm"));
  const [endTime, setEndTime] = useState(format(addHours(time, 1), "HH:mm"));
  const [isCreating, setIsCreating] = useState(false);
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [repetition, setRepetition] = useState<RepetitionSettings>({
    enabled: false,
    interval: 1,
    frequency: "week",
    ends: "never",
  });
  const { hideNav, showNav } = useMobileNav();

  // Hide/show bottom nav when sheet opens/closes
  useEffect(() => {
    if (open) {
      hideNav();
    } else {
      showNav();
    }
    return () => showNav();
  }, [open, hideNav, showNav]);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setEventDate(time);
      setStartTime(format(time, "HH:mm"));
      setEndTime(format(addHours(time, 1), "HH:mm"));
      setRepetition({
        enabled: false,
        interval: 1,
        frequency: "week",
        ends: "never",
      });
      setShowRepeatOptions(false);
    }
  }, [open, time]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      // Parse times
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);

      const startDateTime = setMinutes(setHours(eventDate, startHours), startMinutes);
      const endDateTime = setMinutes(setHours(eventDate, endHours), endMinutes);

      // Build recurrence rule
      const recurrenceRule = buildRecurrenceRule(repetition);

      const res = await fetch("/api/technician-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId,
          locationId,
          title: title.trim(),
          blockType: "PERSONAL",
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          recurrenceRule,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create event");
      }

      toast.success("Personal event created");
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  };

  const getRepeatDescription = () => {
    if (!repetition.enabled) return "Does not repeat";

    const freqMap = { day: "day", week: "week", month: "month" };
    const freqPlural = { day: "days", week: "weeks", month: "months" };

    let desc =
      repetition.interval === 1
        ? `Every ${freqMap[repetition.frequency]}`
        : `Every ${repetition.interval} ${freqPlural[repetition.frequency]}`;

    if (repetition.ends === "after" && repetition.endAfterOccurrences) {
      desc += `, ${repetition.endAfterOccurrences} times`;
    } else if (repetition.ends === "on_date" && repetition.endDate) {
      desc += `, until ${format(new Date(repetition.endDate), "MMM d, yyyy")}`;
    }

    return desc;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden"
        style={{ height: "100dvh" }}
      >
        <SheetTitle className="sr-only">Create Personal Event</SheetTitle>
        <SheetDescription className="sr-only">
          Create a personal event or time block for {technicianName}
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Personal Event</h1>
          <div className="min-w-[44px]" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="space-y-4">
            {/* Title */}
            <div className="bg-white rounded-xl p-4">
              <label className="text-sm font-medium text-gray-500 block mb-2">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Lunch break, Meeting, Training"
                autoFocus
              />
            </div>

            {/* Date */}
            <div className="bg-white rounded-xl p-4">
              <label className="text-sm font-medium text-gray-500 block mb-2">
                Date
              </label>
              <DatePicker
                date={eventDate}
                onDateChange={(date) => date && setEventDate(date)}
              />
            </div>

            {/* Time */}
            <div className="bg-white rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 block mb-2">
                    Start Time
                  </label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 block mb-2">
                    End Time
                  </label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Technician */}
            <div className="bg-white rounded-xl p-4">
              <label className="text-sm font-medium text-gray-500 block mb-2">
                For
              </label>
              <div className="font-medium">{technicianName}</div>
            </div>

            {/* Repeat */}
            <div className="bg-white rounded-xl overflow-hidden">
              <button
                onClick={() => setShowRepeatOptions(!showRepeatOptions)}
                className="w-full flex items-center justify-between p-4 active:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Repeat className="h-5 w-5 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Repeat</div>
                    <div className="text-sm text-gray-500">{getRepeatDescription()}</div>
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    "h-5 w-5 text-gray-400 transition-transform",
                    showRepeatOptions && "rotate-90"
                  )}
                />
              </button>

              {showRepeatOptions && (
                <div className="p-4 pt-0 space-y-4 border-t border-gray-100">
                  {/* Enable Repeat */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Enable repeat</span>
                    <Switch
                      checked={repetition.enabled}
                      onCheckedChange={(checked) =>
                        setRepetition({ ...repetition, enabled: checked })
                      }
                    />
                  </div>

                  {repetition.enabled && (
                    <>
                      {/* Interval & Frequency */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Every</span>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={repetition.interval}
                          onChange={(e) =>
                            setRepetition({
                              ...repetition,
                              interval: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-16 text-center"
                        />
                        <Select
                          value={repetition.frequency}
                          onValueChange={(value: "day" | "week" | "month") =>
                            setRepetition({ ...repetition, frequency: value })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">day(s)</SelectItem>
                            <SelectItem value="week">week(s)</SelectItem>
                            <SelectItem value="month">month(s)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* End Condition */}
                      <div className="space-y-2">
                        <span className="text-gray-600">Ends</span>
                        <Select
                          value={repetition.ends}
                          onValueChange={(value: "never" | "after" | "on_date") =>
                            setRepetition({ ...repetition, ends: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="after">After # occurrences</SelectItem>
                            <SelectItem value="on_date">On a date</SelectItem>
                          </SelectContent>
                        </Select>

                        {repetition.ends === "after" && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">After</span>
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={repetition.endAfterOccurrences || 10}
                              onChange={(e) =>
                                setRepetition({
                                  ...repetition,
                                  endAfterOccurrences: parseInt(e.target.value) || 10,
                                })
                              }
                              className="w-16 text-center"
                            />
                            <span className="text-gray-600">occurrences</span>
                          </div>
                        )}

                        {repetition.ends === "on_date" && (
                          <DatePicker
                            date={
                              repetition.endDate
                                ? new Date(repetition.endDate)
                                : addHours(new Date(), 24 * 30)
                            }
                            onDateChange={(date) =>
                              setRepetition({
                                ...repetition,
                                endDate: date?.toISOString().split("T")[0],
                              })
                            }
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-24" />
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 p-4 bg-white border-t border-gray-200"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <Button
            onClick={handleCreate}
            className="w-full h-12"
            disabled={isCreating || !title.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Event
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
