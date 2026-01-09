"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  X,
  Phone,
  Clock,
  MapPin,
  User,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  AlertTriangle,
  Ban,
  Calendar,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MobileStatusPicker } from "./mobile-status-picker";
import { useMobileNav } from "@/contexts/mobile-nav-context";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface LineItem {
  id: string;
  itemType: "service" | "product" | "discount";
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  notes?: string;
  noShowProtected?: boolean;
  noShowFeeCharged?: boolean;
  noShowFeeAmount?: number;
  createdAt?: Date;
  bookedBy?: string;
  smsConfirmedAt?: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    phoneVerified: boolean;
    notes?: string;
    paymentMethods?: PaymentMethod[];
  };
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
  };
  technician?: {
    id: string;
    firstName: string;
    lastName: string;
    color: string;
  };
  location?: {
    id: string;
    name: string;
    city?: string;
  };
}

interface AppointmentHistory {
  id: string;
  serviceName: string;
  technicianName: string;
  technicianColor: string;
  startTime: Date;
  status: string;
}

interface MobileAppointmentDetailSheetProps {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
  onRefresh?: () => void;
}

const statusLabels: Record<string, string> = {
  PENDING: "Awaiting Confirmation",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CHECKED_IN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

export function MobileAppointmentDetailSheet({
  appointmentId,
  open,
  onOpenChange,
  onStatusChange,
  onRefresh,
}: MobileAppointmentDetailSheetProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
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

  // Fetch appointment details
  useEffect(() => {
    if (open && appointmentId) {
      fetchAppointment();
    }
  }, [open, appointmentId]);

  const fetchAppointment = async () => {
    if (!appointmentId) return;
    setIsLoading(true);
    try {
      const [apptRes, itemsRes] = await Promise.all([
        fetch(`/api/appointments/${appointmentId}`),
        fetch(`/api/appointments/${appointmentId}/line-items`),
      ]);

      if (apptRes.ok) {
        const data = await apptRes.json();
        setAppointment({
          ...data.appointment,
          startTime: new Date(data.appointment.startTime),
          endTime: new Date(data.appointment.endTime),
        });

        // Fetch history if client exists
        if (data.appointment.client?.id) {
          fetchHistory(data.appointment.client.id);
        }
      }

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setLineItems(data.lineItems || []);
      }
    } catch (error) {
      console.error("Failed to fetch appointment:", error);
      toast.error("Failed to load appointment");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/appointments?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setHistory(
          (data.appointments || [])
            .filter((a: any) => a.id !== appointmentId)
            .map((a: any) => ({
              ...a,
              startTime: new Date(a.startTime),
            }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setAppointment((prev) => (prev ? { ...prev, status: newStatus } : null));
      setShowStatusPicker(false);
      toast.success(`Status updated to ${statusLabels[newStatus]}`);
      onStatusChange?.();
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to cancel");

      setAppointment((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      setShowCancelConfirm(false);
      toast.success("Appointment cancelled");
      onStatusChange?.();
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to cancel appointment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoShow = async () => {
    if (!appointment) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NO_SHOW" }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setAppointment((prev) => (prev ? { ...prev, status: "NO_SHOW" } : null));
      setShowNoShowConfirm(false);
      toast.success("Marked as no-show");
      onStatusChange?.();
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to mark as no-show");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCall = () => {
    if (appointment?.client?.phone) {
      window.location.href = `tel:${appointment.client.phone}`;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
  };

  const getActionButtons = () => {
    if (!appointment) return null;
    const status = appointment.status;

    const buttons = [];

    if (status === "PENDING") {
      buttons.push(
        <Button
          key="confirm"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={() => handleStatusChange("CONFIRMED")}
          disabled={isSaving}
        >
          <Check className="h-4 w-4 mr-2" />
          Confirm
        </Button>
      );
    }

    if (status === "CONFIRMED") {
      buttons.push(
        <Button
          key="checkin"
          className="flex-1 bg-blue-600 hover:bg-blue-700"
          onClick={() => handleStatusChange("CHECKED_IN")}
          disabled={isSaving}
        >
          <Check className="h-4 w-4 mr-2" />
          Check In
        </Button>
      );
    }

    if (status === "CHECKED_IN") {
      buttons.push(
        <Button
          key="start"
          className="flex-1 bg-blue-600 hover:bg-blue-700"
          onClick={() => handleStatusChange("IN_PROGRESS")}
          disabled={isSaving}
        >
          Start Service
        </Button>
      );
    }

    if (status === "IN_PROGRESS") {
      buttons.push(
        <Button
          key="complete"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={() => handleStatusChange("COMPLETED")}
          disabled={isSaving}
        >
          <Check className="h-4 w-4 mr-2" />
          Complete
        </Button>
      );
    }

    if (!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(status)) {
      buttons.push(
        <Button
          key="noshow"
          variant="outline"
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setShowNoShowConfirm(true)}
          disabled={isSaving}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          No-Show
        </Button>
      );
    }

    return buttons;
  };

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-none p-0 flex flex-col [&>button]:hidden"
          style={{ height: "100dvh" }}
        >
          <SheetTitle className="sr-only">Appointment Details</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage appointment details
          </SheetDescription>

          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold">Appointment</h1>
            <div className="min-w-[44px]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : appointment ? (
              <div className="space-y-3 p-4">
                {/* Status Badge */}
                <button
                  onClick={() => setShowStatusPicker(true)}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-xl"
                >
                  <span className="text-sm text-gray-500">Status</span>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("font-medium", statusColors[appointment.status])}>
                      {statusLabels[appointment.status]}
                    </Badge>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                </button>

                {/* Client Section */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium"
                      style={{ backgroundColor: appointment.technician?.color || "#6B7280" }}
                    >
                      {appointment.client?.firstName?.[0]}
                      {appointment.client?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">
                        {appointment.client?.firstName} {appointment.client?.lastName}
                      </h3>
                      <button
                        onClick={handleCall}
                        className="flex items-center gap-1 text-blue-600 text-sm"
                      >
                        <Phone className="h-3 w-3" />
                        {appointment.client?.phone}
                      </button>
                    </div>
                  </div>

                  {appointment.client?.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                      {appointment.client.notes}
                    </div>
                  )}
                </div>

                {/* Time & Location */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">
                        {format(appointment.startTime, "EEEE, MMMM d, yyyy")}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(appointment.startTime, "h:mm a")} -{" "}
                        {format(appointment.endTime, "h:mm a")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: appointment.technician?.color }}
                      />
                      <span>
                        {appointment.technician?.firstName} {appointment.technician?.lastName}
                      </span>
                    </div>
                  </div>

                  {appointment.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <span>{appointment.location.name}</span>
                    </div>
                  )}
                </div>

                {/* Services / Line Items */}
                <div className="bg-white rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Services</h4>
                  <div className="space-y-2">
                    {lineItems.length > 0 ? (
                      lineItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            {item.quantity > 1 && (
                              <span className="text-gray-500 text-sm ml-1">
                                × {item.quantity}
                              </span>
                            )}
                          </div>
                          <span className={item.itemType === "discount" ? "text-green-600" : ""}>
                            {item.itemType === "discount" ? "-" : ""}${Math.abs(item.totalAmount)}
                          </span>
                        </div>
                      ))
                    ) : appointment.service ? (
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{appointment.service.name}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            ({formatDuration(appointment.service.durationMinutes)})
                          </span>
                        </div>
                        <span>${appointment.service.price}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t mt-3 pt-3 flex justify-between items-center font-semibold">
                    <span>Total</span>
                    <span>
                      ${lineItems.length > 0 ? calculateTotal() : appointment.service?.price || 0}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {appointment.notes && (
                  <div className="bg-white rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
                    <p className="text-gray-700">{appointment.notes}</p>
                  </div>
                )}

                {/* Appointment History */}
                {history.length > 0 && (
                  <div className="bg-white rounded-xl">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <h4 className="text-sm font-medium text-gray-500">
                        Past Appointments ({history.length})
                      </h4>
                      {showHistory ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {showHistory && (
                      <div className="px-4 pb-4 space-y-2">
                        {history.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm"
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: h.technicianColor }}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{h.serviceName}</div>
                              <div className="text-gray-500">
                                {format(h.startTime, "MMM d, yyyy")}
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn("text-xs", statusColors[h.status])}
                            >
                              {statusLabels[h.status]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel Button */}
                {!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status) && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full text-red-600 text-sm py-3"
                    disabled={isSaving}
                  >
                    Cancel Appointment
                  </button>
                )}

                {/* Bottom padding */}
                <div className="h-24" />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Appointment not found
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {appointment && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status) && (
            <div
              className="flex-shrink-0 p-4 bg-white border-t border-gray-200 flex gap-2"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              {getActionButtons()}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Status Picker */}
      <MobileStatusPicker
        open={showStatusPicker}
        onOpenChange={setShowStatusPicker}
        currentStatus={appointment?.status || "PENDING"}
        onStatusSelect={handleStatusChange}
        isLoading={isSaving}
      />

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-4 space-y-4 animate-in slide-in-from-bottom">
            <h3 className="text-lg font-semibold text-center">Cancel Appointment?</h3>
            <p className="text-gray-600 text-center text-sm">
              This will cancel the appointment for {appointment?.client?.firstName}.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isSaving}
              >
                Keep
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel It"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No-Show Confirmation */}
      {showNoShowConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-4 space-y-4 animate-in slide-in-from-bottom">
            <h3 className="text-lg font-semibold text-center">Mark as No-Show?</h3>
            <p className="text-gray-600 text-center text-sm">
              {appointment?.client?.firstName} will be marked as a no-show.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNoShowConfirm(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleNoShow}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark No-Show"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
