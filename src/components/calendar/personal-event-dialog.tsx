"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { X, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { formatRecurrenceRule, parseRecurrenceRule } from "@/lib/recurrence";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RepetitionState {
  enabled: boolean;
  interval: number;
  frequency: "day" | "week" | "month";
  ends: "never" | "after" | "on_date";
  endAfterOccurrences?: number;
  endDate?: string;
}

type EditScope = "this_only" | "this_and_future" | "all";

interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  recurrenceRule?: string | null;
  instanceDate?: string;
  isRecurring?: boolean;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface PersonalEventDialogProps {
  block: TechnicianBlock | null;
  technicians: Technician[];
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export function PersonalEventDialog({
  block,
  technicians,
  onClose,
  onSave,
  onDelete,
}: PersonalEventDialogProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScopeModal, setShowScopeModal] = useState<"save" | "delete" | null>(null);
  const [selectedScope, setSelectedScope] = useState<EditScope>("all");
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [repetition, setRepetition] = useState<RepetitionState>({
    enabled: false,
    interval: 1,
    frequency: "week",
    ends: "never",
  });
  const [originalRepetition, setOriginalRepetition] = useState<RepetitionState>({
    enabled: false,
    interval: 1,
    frequency: "week",
    ends: "never",
  });

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    title: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
  });

  // Initialize form when block changes
  useEffect(() => {
    if (block) {
      const blockStartDate = new Date(block.startTime);
      const blockEndDate = new Date(block.endTime);
      const blockStartTime = format(blockStartDate, "HH:mm");
      const blockEndTime = format(blockEndDate, "HH:mm");

      setTitle(block.title);
      setStartDate(blockStartDate);
      setEndDate(blockEndDate);
      setStartTime(blockStartTime);
      setEndTime(blockEndTime);

      // Parse recurrence rule if present
      let repState: RepetitionState = {
        enabled: false,
        interval: 1,
        frequency: "week",
        ends: "never",
      };

      if (block.recurrenceRule) {
        const parsed = parseRecurrenceRule(block.recurrenceRule);
        if (parsed) {
          repState = {
            enabled: true,
            interval: parsed.interval,
            frequency: parsed.freq === "DAILY" ? "day" : parsed.freq === "WEEKLY" ? "week" : "month",
            ends: parsed.count ? "after" : parsed.until ? "on_date" : "never",
            endAfterOccurrences: parsed.count,
            endDate: parsed.until ? format(parsed.until, "yyyy-MM-dd") : undefined,
          };
        }
      }

      setRepetition(repState);
      setOriginalRepetition(repState);

      // Store original values
      setOriginalValues({
        title: block.title,
        startDate: format(blockStartDate, "yyyy-MM-dd"),
        endDate: format(blockEndDate, "yyyy-MM-dd"),
        startTime: blockStartTime,
        endTime: blockEndTime,
      });
    }
  }, [block]);

  // Helper to compare repetition states
  const repetitionChanged =
    repetition.enabled !== originalRepetition.enabled ||
    repetition.interval !== originalRepetition.interval ||
    repetition.frequency !== originalRepetition.frequency ||
    repetition.ends !== originalRepetition.ends ||
    repetition.endAfterOccurrences !== originalRepetition.endAfterOccurrences ||
    repetition.endDate !== originalRepetition.endDate;

  // Check if there are unsaved changes
  const hasChanges =
    title !== originalValues.title ||
    format(startDate, "yyyy-MM-dd") !== originalValues.startDate ||
    format(endDate, "yyyy-MM-dd") !== originalValues.endDate ||
    startTime !== originalValues.startTime ||
    endTime !== originalValues.endTime ||
    repetitionChanged;

  // Build recurrence rule from state
  const buildRecurrenceRule = (): string | null => {
    if (!repetition.enabled) return null;

    const freq = repetition.frequency.toUpperCase();
    let rule = `FREQ=${freq};INTERVAL=${repetition.interval}`;

    if (repetition.ends === "after" && repetition.endAfterOccurrences) {
      rule += `;COUNT=${repetition.endAfterOccurrences}`;
    } else if (repetition.ends === "on_date" && repetition.endDate) {
      rule += `;UNTIL=${repetition.endDate.replace(/-/g, "")}`;
    }

    return rule;
  };

  if (!block) return null;

  const technician = technicians.find((t) => t.id === block.technicianId);

  const handleSaveClick = () => {
    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    // If this is a recurring event, show scope selection
    if (block?.isRecurring && block?.recurrenceRule) {
      setShowScopeModal("save");
      setSelectedScope("this_only");
    } else {
      handleSave("all");
    }
  };

  const handleSave = async (scope: EditScope) => {
    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    setSaving(true);
    setShowScopeModal(null);
    try {
      // Build the start and end datetime
      const startDateTime = new Date(startDate);
      const [startHour, startMin] = startTime.split(":").map(Number);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(endDate);
      const [endHour, endMin] = endTime.split(":").map(Number);
      endDateTime.setHours(endHour, endMin, 0, 0);

      // Format as local time string to avoid timezone conversion
      const formatLocalDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      // Build URL with scope params for recurring events
      let url = `/api/technician-blocks/${block.id}`;
      if (block?.isRecurring && scope !== "all") {
        const params = new URLSearchParams({
          scope,
          instanceDate: block.instanceDate || format(startDate, "yyyy-MM-dd"),
        });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startTime: formatLocalDateTime(startDateTime),
          endTime: formatLocalDateTime(endDateTime),
          recurrenceRule: buildRecurrenceRule(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update event");
      }

      toast.success("Event updated successfully");
      onSave();
      onClose();
    } catch (error) {
      console.error("Update event error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    // If this is a recurring event, show scope selection
    if (block?.isRecurring && block?.recurrenceRule) {
      setShowScopeModal("delete");
      setSelectedScope("this_only");
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleDelete = async (scope: EditScope) => {
    setDeleting(true);
    setShowScopeModal(null);
    setShowDeleteConfirm(false);
    try {
      // Build URL with scope params for recurring events
      let url = `/api/technician-blocks/${block.id}`;
      if (block?.isRecurring && scope !== "all") {
        const params = new URLSearchParams({
          scope,
          instanceDate: block.instanceDate || format(startDate, "yyyy-MM-dd"),
        });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete event");
      }

      toast.success("Event deleted successfully");
      onDelete();
      onClose();
    } catch (error) {
      console.error("Delete event error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-auto min-h-[56px] px-4 py-2 border-b border-gray-200 flex-shrink-0 gap-2 flex-wrap">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 flex-1 text-center min-w-0 order-first sm:order-none w-full sm:w-auto">
          Edit Personal Event
        </h2>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleDeleteClick}
            disabled={saving || deleting}
            className="h-9 px-3 sm:px-4 rounded-full border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
          <button
            onClick={handleSaveClick}
            disabled={saving || deleting || !hasChanges}
            className="h-9 px-4 sm:px-6 rounded-full bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-8 px-6">
          {/* Event Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-medium text-gray-900 mb-3">Event details</h3>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Title */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-2 sm:py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Title
                </div>
                <div className="px-2 py-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event title"
                    className="border-0 shadow-none focus-visible:ring-0 h-10 text-sm"
                  />
                </div>
              </div>

              {/* Staff Member */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-2 sm:py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Staff member
                </div>
                <div className="px-4 py-2 sm:py-3 flex items-center gap-2">
                  {technician && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: technician.color }}
                    />
                  )}
                  <span className="text-sm text-gray-900">
                    {technician
                      ? `${technician.firstName} ${technician.lastName}`
                      : "Unknown"}
                  </span>
                </div>
              </div>

              {/* Recurrence Info - Editable */}
              <div
                className="grid grid-cols-1 sm:grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setShowRepeatModal(true)}
              >
                <div className="px-4 py-2 sm:py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Repeats
                </div>
                <div className="px-4 py-2 sm:py-3 flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    {repetition.enabled ? (
                      <>
                        <Repeat className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">
                          {repetition.interval === 1
                            ? repetition.frequency === "day"
                              ? "Daily"
                              : repetition.frequency === "week"
                              ? "Weekly"
                              : "Monthly"
                            : `Every ${repetition.interval} ${repetition.frequency}s`}
                          {repetition.ends === "after" && repetition.endAfterOccurrences
                            ? `, ${repetition.endAfterOccurrences} times`
                            : repetition.ends === "on_date" && repetition.endDate
                            ? ` until ${format(new Date(repetition.endDate), "MMM d, yyyy")}`
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Does not repeat</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">Edit</span>
                </div>
              </div>

              {/* Start Date/Time */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-2 sm:py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Start
                </div>
                <div className="px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <DatePicker
                    date={startDate}
                    onDateChange={(date) => date && setStartDate(date)}
                    className="text-sm"
                  />
                  <TimePicker
                    time={startTime}
                    onTimeChange={setStartTime}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* End Date/Time */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-2 sm:py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  End
                </div>
                <div className="px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <DatePicker
                    date={endDate}
                    onDateChange={(date) => date && setEndDate(date)}
                    className="text-sm"
                  />
                  <TimePicker
                    time={endTime}
                    onTimeChange={setEndTime}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal (for non-recurring events) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Event
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this personal event? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete("all")}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope Selection Modal (for recurring events) */}
      {showScopeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowScopeModal(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {showScopeModal === "delete" ? "Delete Recurring Event" : "Edit Recurring Event"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This is a recurring event. What would you like to {showScopeModal === "delete" ? "delete" : "edit"}?
            </p>

            <div className="space-y-2 mb-6">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="this_only"
                  checked={selectedScope === "this_only"}
                  onChange={() => setSelectedScope("this_only")}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-900">This event only</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="this_and_future"
                  checked={selectedScope === "this_and_future"}
                  onChange={() => setSelectedScope("this_and_future")}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-900">This and all future events</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={selectedScope === "all"}
                  onChange={() => setSelectedScope("all")}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-900">All events in the series</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowScopeModal(null)}
                disabled={saving || deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showScopeModal === "delete") {
                    handleDelete(selectedScope);
                  } else {
                    handleSave(selectedScope);
                  }
                }}
                disabled={saving || deleting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  showScopeModal === "delete"
                    ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
                    : "bg-gray-900 hover:bg-gray-800 active:bg-gray-700"
                }`}
              >
                {saving || deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : showScopeModal === "delete" ? (
                  "Delete"
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Settings Modal */}
      {showRepeatModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRepeatModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Repeat Settings
            </h3>

            {/* Enable/Disable Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repetition.enabled}
                  onChange={(e) =>
                    setRepetition((p) => ({ ...p, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-900">
                  Enable repetition
                </span>
              </label>
            </div>

            {repetition.enabled && (
              <>
                {/* Repeat every */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Repeat every
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="number"
                        min="1"
                        value={repetition.interval}
                        onChange={(e) =>
                          setRepetition((p) => ({
                            ...p,
                            interval: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Select
                        value={repetition.frequency}
                        onValueChange={(v) =>
                          setRepetition((p) => ({
                            ...p,
                            frequency: v as "day" | "week" | "month",
                          }))
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue>
                            {repetition.frequency === "day" &&
                              (repetition.interval === 1 ? "Day" : "Days")}
                            {repetition.frequency === "week" &&
                              (repetition.interval === 1 ? "Week" : "Weeks")}
                            {repetition.frequency === "month" &&
                              (repetition.interval === 1 ? "Month" : "Months")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">
                            {repetition.interval === 1 ? "Day" : "Days"}
                          </SelectItem>
                          <SelectItem value="week">
                            {repetition.interval === 1 ? "Week" : "Weeks"}
                          </SelectItem>
                          <SelectItem value="month">
                            {repetition.interval === 1 ? "Month" : "Months"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Ends */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Ends
                  </label>
                  <Select
                    value={repetition.ends}
                    onValueChange={(v) =>
                      setRepetition((p) => ({
                        ...p,
                        ends: v as "never" | "after" | "on_date",
                      }))
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="after">After # occurrences</SelectItem>
                      <SelectItem value="on_date">On date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* After occurrences */}
                {repetition.ends === "after" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Number of occurrences
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={repetition.endAfterOccurrences || ""}
                      onChange={(e) =>
                        setRepetition((p) => ({
                          ...p,
                          endAfterOccurrences: parseInt(e.target.value) || undefined,
                        }))
                      }
                      className="h-10"
                      placeholder="e.g., 10"
                    />
                  </div>
                )}

                {/* On date */}
                {repetition.ends === "on_date" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      End date
                    </label>
                    <Input
                      type="date"
                      value={repetition.endDate || ""}
                      onChange={(e) =>
                        setRepetition((p) => ({
                          ...p,
                          endDate: e.target.value || undefined,
                        }))
                      }
                      className="h-10"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRepeatModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
