"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Loader2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

interface QuickBlockDialogProps {
  technicianId: string;
  technicianName: string;
  startTime: Date;
  endTime: Date;
  onSave: (title: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function QuickBlockDialog({
  technicianName,
  startTime,
  endTime,
  onSave,
  onCancel,
  isLoading,
}: QuickBlockDialogProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave(title.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  // Calculate duration in minutes
  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / (1000 * 60)
  );
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;
  const durationText =
    durationHours > 0
      ? remainingMinutes > 0
        ? `${durationHours}h ${remainingMinutes}m`
        : `${durationHours}h`
      : `${durationMinutes}m`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4"
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Add Personal Event
              </h3>
            </div>

            {/* Title input */}
            <div className="mb-4">
              <label
                htmlFor="block-title"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Event Title
              </label>
              <Input
                id="block-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Lunch, Break, Meeting..."
                autoFocus
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {/* Time info */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">
                  {technicianName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>
                  {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                </span>
                <span className="text-gray-400">({durationText})</span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isLoading}
              className="h-9 px-4 rounded-full bg-gray-800 hover:bg-gray-900 active:bg-gray-950 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
