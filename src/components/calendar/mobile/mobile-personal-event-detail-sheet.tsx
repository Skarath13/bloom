"use client";

import { useState, useEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { X, Loader2, Trash2, Repeat, Calendar, Clock, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatRecurrenceRule } from "@/lib/recurrence";
import { useMobileNav } from "@/contexts/mobile-nav-context";

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

interface MobilePersonalEventDetailSheetProps {
  block: TechnicianBlock | null;
  technician?: Technician | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
}

type EditScope = "this_only" | "this_and_future" | "all";

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

export function MobilePersonalEventDetailSheet({
  block,
  technician,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: MobilePersonalEventDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScopeModal, setShowScopeModal] = useState<"save" | "delete" | null>(null);
  const [selectedScope, setSelectedScope] = useState<EditScope>("all");
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

  // Initialize form when block changes
  useEffect(() => {
    if (block && open) {
      setTitle(block.title);
      setEventDate(block.startTime);
      setStartTime(format(block.startTime, "HH:mm"));
      setEndTime(format(block.endTime, "HH:mm"));
      setIsEditing(false);
    }
  }, [block?.id, open]);

  const handleClose = () => {
    setIsEditing(false);
    onOpenChange(false);
  };

  const handleSave = async (scope?: EditScope) => {
    if (!block) return;

    // If recurring and no scope selected, show scope modal
    if (block.isRecurring && !scope) {
      setShowScopeModal("save");
      return;
    }

    setIsSaving(true);
    try {
      // Parse times
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);

      const startDateTime = setMinutes(setHours(eventDate, startHours), startMinutes);
      const endDateTime = setMinutes(setHours(eventDate, endHours), endMinutes);

      const body: any = {
        title: title.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      };

      if (scope) {
        body.scope = scope;
        if (block.instanceDate) {
          body.instanceDate = block.instanceDate;
        }
      }

      const res = await fetch(`/api/technician-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update");
      }

      toast.success("Event updated");
      setIsEditing(false);
      setShowScopeModal(null);
      onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (scope?: EditScope) => {
    if (!block) return;

    // If recurring and no scope selected, show scope modal
    if (block.isRecurring && !scope) {
      setShowScopeModal("delete");
      return;
    }

    setIsDeleting(true);
    try {
      const url = new URL(`/api/technician-blocks/${block.id}`, window.location.origin);
      if (scope) {
        url.searchParams.set("scope", scope);
        if (block.instanceDate) {
          url.searchParams.set("instanceDate", block.instanceDate);
        }
      }

      const res = await fetch(url.toString(), { method: "DELETE" });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }

      toast.success("Event deleted");
      setShowDeleteConfirm(false);
      setShowScopeModal(null);
      onDelete();
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!block) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-none p-0 flex flex-col [&>button]:hidden"
          style={{ height: "100dvh" }}
        >
          <SheetTitle className="sr-only">Personal Event</SheetTitle>
          <SheetDescription className="sr-only">
            View and edit personal event details
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
            <button
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600 font-medium"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isEditing ? (
                "Save"
              ) : (
                "Edit"
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="space-y-4">
              {/* Title */}
              <div className="bg-white rounded-xl p-4">
                <label className="text-sm font-medium text-gray-500 block mb-2">
                  Title
                </label>
                {isEditing ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event title"
                  />
                ) : (
                  <div className="font-semibold text-lg">{block.title}</div>
                )}
              </div>

              {/* Date & Time */}
              <div className="bg-white rounded-xl p-4 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-500 block mb-2">
                        Date
                      </label>
                      <DatePicker
                        date={eventDate}
                        onDateChange={(date) => date && setEventDate(date)}
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-500 block mb-2">
                          Start
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
                          End
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <span>{format(block.startTime, "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <span>
                        {format(block.startTime, "h:mm a")} - {format(block.endTime, "h:mm a")}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Technician */}
              {technician && (
                <div className="bg-white rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: technician.color }}
                    />
                    <span className="font-medium">
                      {technician.firstName} {technician.lastName}
                    </span>
                  </div>
                </div>
              )}

              {/* Repeat Info */}
              {block.recurrenceRule && (
                <div className="bg-white rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Repeating</div>
                      <div className="text-sm text-gray-500">
                        {formatRecurrenceRule(block.recurrenceRule)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Button */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (block.isRecurring) {
                    setShowScopeModal("delete");
                  } else {
                    setShowDeleteConfirm(true);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Event
              </Button>
            </div>

            {/* Bottom padding */}
            <div className="h-20" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation (non-recurring) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{block.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scope Selection Modal (for recurring events) */}
      {showScopeModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-4 space-y-4 animate-in slide-in-from-bottom">
            <h3 className="text-lg font-semibold text-center">
              {showScopeModal === "delete" ? "Delete Recurring Event" : "Edit Recurring Event"}
            </h3>
            <p className="text-gray-600 text-center text-sm">
              This is a recurring event. Which events would you like to{" "}
              {showScopeModal === "delete" ? "delete" : "update"}?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedScope("this_only");
                  if (showScopeModal === "delete") {
                    handleDelete("this_only");
                  } else {
                    handleSave("this_only");
                  }
                }}
                className="w-full p-4 text-left rounded-lg bg-gray-50 active:bg-gray-100"
              >
                <div className="font-medium">This event only</div>
                <div className="text-sm text-gray-500">
                  Only {showScopeModal === "delete" ? "delete" : "update"} this occurrence
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedScope("this_and_future");
                  if (showScopeModal === "delete") {
                    handleDelete("this_and_future");
                  } else {
                    handleSave("this_and_future");
                  }
                }}
                className="w-full p-4 text-left rounded-lg bg-gray-50 active:bg-gray-100"
              >
                <div className="font-medium">This and future events</div>
                <div className="text-sm text-gray-500">
                  {showScopeModal === "delete" ? "Delete" : "Update"} this and all future occurrences
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedScope("all");
                  if (showScopeModal === "delete") {
                    handleDelete("all");
                  } else {
                    handleSave("all");
                  }
                }}
                className="w-full p-4 text-left rounded-lg bg-gray-50 active:bg-gray-100"
              >
                <div className="font-medium">All events</div>
                <div className="text-sm text-gray-500">
                  {showScopeModal === "delete" ? "Delete" : "Update"} all occurrences
                </div>
              </button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowScopeModal(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
