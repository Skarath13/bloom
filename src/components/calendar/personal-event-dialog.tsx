"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
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

  // Check if there are unsaved changes
  const hasChanges =
    title !== originalValues.title ||
    format(startDate, "yyyy-MM-dd") !== originalValues.startDate ||
    format(endDate, "yyyy-MM-dd") !== originalValues.endDate ||
    startTime !== originalValues.startTime ||
    endTime !== originalValues.endTime;

  if (!block) return null;

  const technician = technicians.find((t) => t.id === block.technicianId);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    setSaving(true);
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

      const response = await fetch(`/api/technician-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startTime: formatLocalDateTime(startDateTime),
          endTime: formatLocalDateTime(endDateTime),
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/technician-blocks/${block.id}`, {
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
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        <h2 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-gray-900">
          Edit Personal Event
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={saving || deleting}
            className="h-9 px-4 rounded-full border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting || !hasChanges}
            className="h-9 px-6 rounded-full bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="grid grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
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
              <div className="grid grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Staff member
                </div>
                <div className="px-4 py-3 flex items-center gap-2">
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

              {/* Start Date/Time */}
              <div className="grid grid-cols-[140px_1fr] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  Start
                </div>
                <div className="px-4 py-2 flex items-center gap-3">
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
              <div className="grid grid-cols-[140px_1fr] group hover:bg-gray-50 transition-colors">
                <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 group-hover:bg-gray-100 transition-colors">
                  End
                </div>
                <div className="px-4 py-2 flex items-center gap-3">
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

      {/* Delete Confirmation Modal */}
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
                onClick={handleDelete}
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
    </div>
  );
}
