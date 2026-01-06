"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Search,
  X,
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  technicianId: string;
  status: string;
  notes?: string;
  noShowProtected?: boolean;
  noShowFeeCharged?: boolean;
  noShowFeeAmount?: number;
  noShowChargedAt?: Date;
  createdAt?: Date;
  bookedBy?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    phoneVerified: boolean;
    stripeCustomerId?: string;
    paymentMethods?: PaymentMethod[];
    notes?: string;
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
  locationName: string;
  startTime: Date;
  status: string;
  noShowProtected: boolean;
}

interface LineItem {
  id: string;
  appointmentId: string;
  itemType: "service" | "product" | "discount";
  serviceId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
}

interface RecurringSettings {
  id: string;
  recurrencePattern: "weekly" | "biweekly" | "every3weeks" | "monthly";
  dayOfWeek: number;
  preferredTime: string;
  startDate: string;
  endDate: string | null;
  occurrences: number | null;
  isActive: boolean;
}

interface AppointmentDetailsDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (data: { status: string; notes: string; startTime?: Date; endTime?: Date }) => Promise<void>;
  onCancel: () => Promise<void>;
  onChargeNoShow: (amount: number, reason: string) => Promise<void>;
  onTakePayment?: () => void;
  onAddCard?: (clientId: string) => Promise<void>;
  onRemoveCard?: (paymentMethodId: string) => Promise<void>;
  onUpdateClientNotes?: (clientId: string, notes: string) => Promise<void>;
  onNavigateToAppointment?: (appointmentId: string) => void;
  saving?: boolean;
}

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Appointment Confirmed",
  CHECKED_IN: "Checked In",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const statusColors: Record<string, string> = {
  PENDING: "text-amber-600",
  CONFIRMED: "text-green-600",
  CHECKED_IN: "text-blue-600",
  IN_PROGRESS: "text-blue-600",
  COMPLETED: "text-gray-500",
  CANCELLED: "text-red-600",
  NO_SHOW: "text-red-600",
};

export function AppointmentDetailsDialog({
  appointment,
  onClose,
  onSave,
  onCancel,
  onChargeNoShow,
  onTakePayment,
  onAddCard,
  onRemoveCard,
  onUpdateClientNotes,
  onNavigateToAppointment,
  saving = false,
}: AppointmentDetailsDialogProps) {
  const [editingNotes, setEditingNotes] = useState("");
  const [editingStatus, setEditingStatus] = useState("");
  const [editingDuration, setEditingDuration] = useState(60);
  const [editingTime, setEditingTime] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [originalNotes, setOriginalNotes] = useState("");
  const [originalStatus, setOriginalStatus] = useState("");
  const [originalDuration, setOriginalDuration] = useState(60);
  const [originalTime, setOriginalTime] = useState("");
  const [originalDate, setOriginalDate] = useState("");
  const [appointmentHistory, setAppointmentHistory] = useState<AppointmentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [chargeFee, setChargeFee] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [removingCard, setRemovingCard] = useState<string | null>(null);
  const [editingClientNotes, setEditingClientNotes] = useState(false);
  const [clientNotesValue, setClientNotesValue] = useState("");
  const [savingClientNotes, setSavingClientNotes] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddDiscountModal, setShowAddDiscountModal] = useState(false);
  const [removingLineItem, setRemovingLineItem] = useState<string | null>(null);
  const [recurringSettings, setRecurringSettings] = useState<RecurringSettings | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);

  useEffect(() => {
    if (appointment) {
      const notes = appointment.notes || "";
      const duration = appointment.service?.durationMinutes ||
        Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000);
      const timeStr = format(appointment.startTime, "HH:mm");
      const dateStr = format(appointment.startTime, "yyyy-MM-dd");
      setEditingNotes(notes);
      setOriginalNotes(notes);
      setEditingStatus(appointment.status);
      setOriginalStatus(appointment.status);
      setEditingDuration(duration);
      setOriginalDuration(duration);
      setEditingTime(timeStr);
      setOriginalTime(timeStr);
      setEditingDate(dateStr);
      setOriginalDate(dateStr);
      fetchAppointmentHistory();
      fetchLineItems();
      fetchRecurringSettings();
    }
  }, [appointment?.id]);

  const fetchRecurringSettings = async () => {
    if (!appointment?.id) return;
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/recurring`);
      if (response.ok) {
        const data = await response.json();
        setRecurringSettings(data.recurring || null);
      }
    } catch (error) {
      console.error("Failed to fetch recurring settings:", error);
    }
  };

  const fetchLineItems = async () => {
    if (!appointment?.id) return;
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/line-items`);
      if (response.ok) {
        const data = await response.json();
        setLineItems(data.lineItems || []);
      }
    } catch (error) {
      console.error("Failed to fetch line items:", error);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = editingNotes !== originalNotes ||
    editingStatus !== originalStatus ||
    editingDuration !== originalDuration ||
    editingTime !== originalTime ||
    editingDate !== originalDate;

  const fetchAppointmentHistory = async () => {
    if (!appointment?.client?.id) return;
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/clients/${appointment.client.id}/appointments?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setAppointmentHistory(data.appointments || []);
      }
    } catch (error) {
      console.error("Failed to fetch appointment history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    if (!appointment) return;

    // Calculate new start time if date or time changed
    let newStartTime: Date | undefined;
    if (editingDate !== originalDate || editingTime !== originalTime) {
      const [hours, minutes] = editingTime.split(":").map(Number);
      newStartTime = new Date(editingDate + "T00:00:00");
      newStartTime.setHours(hours, minutes, 0, 0);
    }

    // Calculate new end time based on duration and possibly new start time
    let newEndTime: Date | undefined;
    const baseStartTime = newStartTime || appointment.startTime;
    if (editingDuration !== originalDuration || editingDate !== originalDate || editingTime !== originalTime) {
      newEndTime = new Date(baseStartTime.getTime() + editingDuration * 60000);
    }

    await onSave({ status: editingStatus, notes: editingNotes, startTime: newStartTime, endTime: newEndTime });
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    if (!onRemoveCard) return;
    setRemovingCard(paymentMethodId);
    try {
      await onRemoveCard(paymentMethodId);
    } catch (error) {
      console.error("Failed to remove card:", error);
    } finally {
      setRemovingCard(null);
    }
  };

  const handleAddCard = async () => {
    if (!onAddCard || !appointment?.client?.id) return;
    setShowAddCardModal(true);
  };

  const handleEditClientNotes = () => {
    setClientNotesValue(appointment?.client?.notes || "");
    setEditingClientNotes(true);
  };

  const handleSaveClientNotes = async () => {
    if (!onUpdateClientNotes || !appointment?.client?.id) return;
    setSavingClientNotes(true);
    try {
      await onUpdateClientNotes(appointment.client.id, clientNotesValue);
      setEditingClientNotes(false);
    } catch (error) {
      console.error("Failed to save client notes:", error);
    } finally {
      setSavingClientNotes(false);
    }
  };

  const handleCancelClientNotes = () => {
    setEditingClientNotes(false);
    setClientNotesValue("");
  };

  const handleAddLineItem = async (item: {
    itemType: "service" | "product" | "discount";
    serviceId?: string;
    productId?: string;
    name: string;
    quantity?: number;
    unitPrice: number;
    discountAmount?: number;
  }) => {
    if (!appointment?.id) return;
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (response.ok) {
        await fetchLineItems();
      }
    } catch (error) {
      console.error("Failed to add line item:", error);
    }
  };

  const handleRemoveLineItem = async (lineItemId: string) => {
    if (!appointment?.id) return;
    setRemovingLineItem(lineItemId);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/line-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId }),
      });
      if (response.ok) {
        await fetchLineItems();
      }
    } catch (error) {
      console.error("Failed to remove line item:", error);
    } finally {
      setRemovingLineItem(null);
    }
  };

  const handleSetupRecurring = async (pattern: "weekly" | "biweekly" | "every3weeks" | "monthly", occurrences: number) => {
    if (!appointment?.id) return;
    setSavingRecurring(true);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrencePattern: pattern,
          occurrences,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setRecurringSettings(data.recurring);
        setShowRecurringModal(false);
      }
    } catch (error) {
      console.error("Failed to set up recurring:", error);
    } finally {
      setSavingRecurring(false);
    }
  };

  const handleCancelRecurring = async (cancelAll: boolean) => {
    if (!appointment?.id) return;
    setSavingRecurring(true);
    try {
      const response = await fetch(
        `/api/appointments/${appointment.id}/recurring?cancelAll=${cancelAll}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setRecurringSettings(null);
      }
    } catch (error) {
      console.error("Failed to cancel recurring:", error);
    } finally {
      setSavingRecurring(false);
    }
  };

  // Calculate totals including line items
  const calculateTotals = () => {
    const primaryServicePrice = appointment?.service?.price || 0;
    const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const discountTotal = lineItems
      .filter(item => item.itemType === "discount")
      .reduce((sum, item) => sum + Math.abs(item.totalAmount), 0);
    return {
      subtotal: primaryServicePrice + lineItemsTotal + discountTotal,
      discount: discountTotal,
      total: primaryServicePrice + lineItemsTotal,
    };
  };

  const totals = calculateTotals();

  const handleCancelConfirm = async () => {
    setProcessing(true);
    try {
      if (chargeFee && hasCard) {
        await onChargeNoShow(25, "Late cancellation fee");
      }
      await onCancel();
      setShowCancelModal(false);
    } catch (error) {
      console.error("Failed to cancel:", error);
    } finally {
      setProcessing(false);
      setChargeFee(false);
    }
  };

  const handleNoShowConfirm = async () => {
    setProcessing(true);
    try {
      if (chargeFee && hasCard) {
        await onChargeNoShow(25, "No-show fee");
      }
      await onSave({ status: "NO_SHOW", notes: editingNotes });
      setShowNoShowModal(false);
    } catch (error) {
      console.error("Failed to mark no-show:", error);
    } finally {
      setProcessing(false);
      setChargeFee(false);
    }
  };

  const hasCard = appointment?.client?.paymentMethods && appointment.client.paymentMethods.length > 0;
  const defaultCard = appointment?.client?.paymentMethods?.[0];

  if (!appointment) return null;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-auto min-h-[56px] px-4 py-2 border-b border-gray-200 flex-shrink-0 gap-2 flex-wrap">
        {/* Left: Close button */}
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        {/* Center: Title */}
        <h2 className="text-xl font-bold text-gray-900 flex-1 text-center min-w-0 order-first sm:order-none w-full sm:w-auto">
          Appointment Details
        </h2>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowCancelModal(true)}
            className="h-9 px-3 sm:px-4 rounded-full border border-red-300 hover:bg-red-50 text-sm font-medium text-red-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="hidden sm:inline">Cancel Appointment</span>
            <span className="sm:hidden">Cancel</span>
          </button>

          <button
            onClick={() => setShowNoShowModal(true)}
            className="h-9 px-3 sm:px-4 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="hidden sm:inline">Mark No-Show</span>
            <span className="sm:hidden">No-Show</span>
          </button>

          {onTakePayment && (
            <button
              onClick={onTakePayment}
              className="h-9 px-3 sm:px-4 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="hidden sm:inline">Take payment</span>
              <span className="sm:hidden">Pay</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={cn(
              "h-9 px-4 sm:px-6 rounded-full text-sm font-medium transition-colors cursor-pointer flex-shrink-0",
              hasChanges
                ? "bg-gray-900 hover:bg-gray-800 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Column - Main content */}
        <div className="flex-1 overflow-y-auto order-2 lg:order-1 min-w-0">
          <div className="max-w-[820px] py-6 sm:py-10 px-4 sm:px-6 lg:ml-auto lg:mr-6 xl:mr-12">
            {/* Client Information */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-normal text-gray-900">Client Information</h3>
                <span className={cn("text-sm font-medium", statusColors[appointment.status])}>
                  {statusLabels[appointment.status]}
                </span>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Name
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900 border-b border-gray-300">
                    {appointment.client?.firstName} {appointment.client?.lastName}
                  </div>
                </div>
                {/* Email & Phone row - stacks on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr_140px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b sm:border-b-0 lg:border-b-0">
                    Email
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900 truncate border-b lg:border-b-0">
                    {appointment.client?.email || "—"}
                  </div>
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 lg:border-l border-gray-300 border-b sm:border-b-0 lg:border-b-0">
                    Phone
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900">
                    {appointment.client?.phone ? formatPhone(appointment.client.phone) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-normal text-gray-900">Appointment Details</h3>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* Date & time */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Date & time
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-300">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                      <DatePicker
                        date={editingDate ? new Date(editingDate + "T00:00:00") : undefined}
                        onDateChange={(date) => setEditingDate(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                      <span className="text-gray-400">at</span>
                      <TimePicker
                        time={editingTime}
                        onTimeChange={setEditingTime}
                      />
                    </div>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                      <Search className="h-4 w-4" />
                      <span className="text-sm hidden sm:inline">Find availability</span>
                    </button>
                  </div>
                </div>
                {/* Location */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Location
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900 border-b border-gray-300 break-words">
                    Elegant Lashes By Katie - {appointment.location?.name || "Unknown"} Location
                  </div>
                </div>
                {/* Repeat */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Repeat
                  </div>
                  <div className="px-4 py-2 sm:py-3 text-sm text-gray-900 flex items-center justify-between border-b border-gray-300">
                    {recurringSettings ? (
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">
                          {recurringSettings.recurrencePattern === "weekly" && "Every week"}
                          {recurringSettings.recurrencePattern === "biweekly" && "Every 2 weeks"}
                          {recurringSettings.recurrencePattern === "every3weeks" && "Every 3 weeks"}
                          {recurringSettings.recurrencePattern === "monthly" && "Every month"}
                        </span>
                        <button
                          onClick={() => handleCancelRecurring(false)}
                          disabled={savingRecurring}
                          className="text-gray-400 hover:text-red-500 cursor-pointer disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">Does not repeat</span>
                    )}
                    <button
                      onClick={() => setShowRecurringModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                    >
                      {recurringSettings ? "Edit" : "Set up repeat"}
                    </button>
                  </div>
                </div>
                {/* Appointment notes */}
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]">
                  <div className="px-4 py-2 sm:py-3 bg-gray-100 text-sm font-medium text-gray-700">
                    Appointment Notes
                  </div>
                  <div className="px-2 py-1">
                    <Input
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Add notes viewable by staff only (optional)"
                      className="border-0 shadow-none focus-visible:ring-0 h-10 text-sm bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Booking metadata */}
              <div className="mt-5 text-center text-sm text-gray-500 space-y-1">
                <p>
                  Booked by {appointment.bookedBy || appointment.client?.firstName} on{" "}
                  {appointment.createdAt
                    ? format(new Date(appointment.createdAt), "MMMM d, yyyy 'at' h:mm a")
                    : "—"}
                </p>
                {hasCard && (
                  <p className="flex items-center justify-center gap-1">
                    <Check className="h-4 w-4" />
                    <span>No-show protected with card ending in {defaultCard?.last4}</span>
                    <button className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </p>
                )}
              </div>
            </div>

            {/* Services Table */}
            <div className="mb-6 relative">
              <div className="border border-gray-300 rounded-lg overflow-hidden overflow-x-auto">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_120px_80px] sm:grid-cols-[1fr_180px_100px] border-b-2 border-gray-300 bg-gray-50 min-w-[300px]">
                  <div className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900">Services</div>
                  <div className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900">Duration</div>
                  <div className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
                </div>

                {/* Primary Service row */}
                <div className="grid grid-cols-[1fr_120px_80px] sm:grid-cols-[1fr_180px_100px] border-b border-gray-300 relative group hover:bg-gray-50 transition-colors min-w-[300px]">
                  <div className="px-4 py-4">
                    <div className="text-sm text-gray-900 leading-snug">
                      {appointment.serviceName}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <span>{appointment.technician?.firstName}</span>
                      <Sparkles className="h-3 w-3" style={{ color: appointment.technician?.color || "#9ca3af" }} />
                      <span>{appointment.location?.city || appointment.location?.name}</span>
                    </div>
                  </div>
                  <div className="px-4 py-4 border-l border-gray-300">
                    <Select
                      value={String(editingDuration)}
                      onValueChange={(value) => setEditingDuration(Number(value))}
                    >
                      <SelectTrigger className="w-28 h-10 text-sm border-gray-300 bg-white cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="5">5m</SelectItem>
                        <SelectItem value="10">10m</SelectItem>
                        <SelectItem value="15">15m</SelectItem>
                        <SelectItem value="30">30m</SelectItem>
                        <SelectItem value="45">45m</SelectItem>
                        <SelectItem value="60">1h</SelectItem>
                        <SelectItem value="75">1h 15m</SelectItem>
                        <SelectItem value="90">1h 30m</SelectItem>
                        <SelectItem value="105">1h 45m</SelectItem>
                        <SelectItem value="120">2h</SelectItem>
                        <SelectItem value="135">2h 15m</SelectItem>
                        <SelectItem value="150">2h 30m</SelectItem>
                        <SelectItem value="165">2h 45m</SelectItem>
                        <SelectItem value="180">3h</SelectItem>
                        <SelectItem value="195">3h 15m</SelectItem>
                        <SelectItem value="210">3h 30m</SelectItem>
                        <SelectItem value="225">3h 45m</SelectItem>
                        <SelectItem value="240">4h</SelectItem>
                        <SelectItem value="270">4h 30m</SelectItem>
                        <SelectItem value="300">5h</SelectItem>
                        <SelectItem value="330">5h 30m</SelectItem>
                        <SelectItem value="360">6h</SelectItem>
                        <SelectItem value="420">7h</SelectItem>
                        <SelectItem value="480">8h</SelectItem>
                        <SelectItem value="540">9h</SelectItem>
                        <SelectItem value="600">10h</SelectItem>
                        <SelectItem value="660">11h</SelectItem>
                        <SelectItem value="720">12h</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="px-4 py-4 text-sm text-gray-900 border-l border-gray-300">
                    ${(appointment.service?.price || 0).toFixed(2)}
                  </div>
                </div>

                {/* Additional service line items */}
                {lineItems
                  .filter(item => item.itemType === "service")
                  .map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_120px_80px] sm:grid-cols-[1fr_180px_100px] border-b border-gray-300 relative group hover:bg-gray-50 transition-colors min-w-[300px]">
                      <div className="px-4 py-4">
                        <div className="text-sm text-gray-900 leading-snug">
                          {item.name}
                        </div>
                        {item.notes && (
                          <div className="text-sm text-gray-500 mt-1">{item.notes}</div>
                        )}
                      </div>
                      <div className="px-4 py-4 border-l border-gray-300 text-sm text-gray-600">
                        —
                      </div>
                      <div className="px-4 py-4 text-sm text-gray-900 border-l border-gray-300 flex items-center justify-between">
                        <span>${item.totalAmount.toFixed(2)}</span>
                        <button
                          onClick={() => handleRemoveLineItem(item.id)}
                          disabled={removingLineItem === item.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {removingLineItem === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                {/* Add a service row */}
                <div className="px-4 py-3">
                  <button
                    onClick={() => setShowAddServiceModal(true)}
                    className="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                  >
                    Add a service
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6 border border-gray-300 rounded-lg overflow-hidden overflow-x-auto">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_60px_70px_80px] sm:grid-cols-[1fr_100px_100px_100px] border-b-2 border-gray-300 bg-gray-50 min-w-[280px]">
                <div className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900">Items</div>
                <div className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900">Qty</div>
                <div className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900">Price</div>
                <div className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
              </div>

              {/* Product line items */}
              {lineItems
                .filter(item => item.itemType === "product")
                .map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_60px_70px_80px] sm:grid-cols-[1fr_100px_100px_100px] border-b border-gray-300 relative group hover:bg-gray-50 transition-colors min-w-[280px]">
                    <div className="px-4 py-3 text-sm text-gray-900">{item.name}</div>
                    <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-300">{item.quantity}</div>
                    <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-300">${item.unitPrice.toFixed(2)}</div>
                    <div className="px-4 py-3 text-sm text-gray-900 border-l border-gray-300 flex items-center justify-between">
                      <span>${item.totalAmount.toFixed(2)}</span>
                      <button
                        onClick={() => handleRemoveLineItem(item.id)}
                        disabled={removingLineItem === item.id}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {removingLineItem === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

              {/* Add an item row */}
              <div className="px-4 py-3">
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                >
                  Add an item
                </button>
              </div>
            </div>

            {/* Totals */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Discount line items */}
              {lineItems
                .filter(item => item.itemType === "discount")
                .map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_1fr] border-b border-gray-300 relative group hover:bg-gray-50 transition-colors">
                    <div className="bg-gray-100 border-r border-gray-300 min-h-[44px]"></div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-gray-700">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-600">-${Math.abs(item.totalAmount).toFixed(2)}</span>
                        <button
                          onClick={() => handleRemoveLineItem(item.id)}
                          disabled={removingLineItem === item.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {removingLineItem === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Add discount row */}
              <div className="grid grid-cols-[1fr_1fr]">
                <div className="bg-gray-100 border-r border-gray-300 min-h-[44px]"></div>
                <div className="px-4 py-3 border-b border-gray-300">
                  <button
                    onClick={() => setShowAddDiscountModal(true)}
                    className="text-sm text-gray-900 underline hover:no-underline font-medium cursor-pointer"
                  >
                    Add discount
                  </button>
                </div>
              </div>
              {/* Total row */}
              <div className="grid grid-cols-[1fr_1fr]">
                <div className="bg-gray-100 border-r border-gray-300 min-h-[44px]"></div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[320px] lg:min-w-[320px] border-b lg:border-b-0 lg:border-l border-gray-200 bg-white overflow-y-auto order-1 lg:order-2 max-h-[40vh] lg:max-h-none">
          <div className="p-4 sm:p-6">
            {/* Client Name */}
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {appointment.client?.firstName} {appointment.client?.lastName}
            </h3>

            {/* Client Notes */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Client Notes</span>
                {onUpdateClientNotes && !editingClientNotes && (
                  <button
                    onClick={handleEditClientNotes}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                  >
                    {appointment.client?.notes ? "Edit" : "Add a note"}
                  </button>
                )}
              </div>
              {editingClientNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={clientNotesValue}
                    onChange={(e) => setClientNotesValue(e.target.value)}
                    placeholder="Add notes about this client..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelClientNotes}
                      disabled={savingClientNotes}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveClientNotes}
                      disabled={savingClientNotes}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                    >
                      {savingClientNotes ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className={cn(
                  "text-sm",
                  appointment.client?.notes ? "text-gray-700" : "text-gray-400 italic"
                )}>
                  {appointment.client?.notes || "No notes for this client"}
                </p>
              )}
            </div>

            <div className="h-px bg-gray-200 my-5" />

            {/* Cards on File */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Cards on File</span>
                {onAddCard && (
                  <button
                    onClick={handleAddCard}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                  >
                    Add card
                  </button>
                )}
              </div>
              {hasCard ? (
                <div className="space-y-2">
                  {appointment?.client?.paymentMethods?.map((card) => (
                    <div key={card.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                          {card.brand}
                        </span>
                        <span className="text-sm text-gray-700">ending in {card.last4}</span>
                        {card.isDefault && (
                          <span className="text-xs text-gray-400">(default)</span>
                        )}
                      </div>
                      {onRemoveCard && (
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          disabled={removingCard === card.id}
                          className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-50"
                        >
                          {removingCard === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No cards on file</p>
              )}
            </div>

            <div className="h-px bg-gray-200 my-5" />

            {/* Appointment History */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Appointment History</h4>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : appointmentHistory.length > 0 ? (
                <div className="space-y-4">
                  {appointmentHistory.map((historyItem, index) => (
                    <div key={historyItem.id}>
                      <button
                        onClick={() => {
                          if (onNavigateToAppointment && historyItem.id !== appointment?.id) {
                            onNavigateToAppointment(historyItem.id);
                          }
                        }}
                        disabled={historyItem.id === appointment?.id}
                        className={cn(
                          "text-sm text-left w-full",
                          historyItem.id === appointment?.id
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                        )}
                      >
                        <p className={cn(
                          "leading-snug select-none",
                          historyItem.id === appointment?.id
                            ? "text-gray-900 font-medium"
                            : "text-blue-600 hover:underline"
                        )}>
                          {historyItem.serviceName}
                          {historyItem.id === appointment?.id && (
                            <span className="ml-2 text-xs text-gray-400">(current)</span>
                          )}
                        </p>
                        <p className="text-gray-500 flex items-center gap-1 mt-1">
                          <span>{historyItem.technicianName}</span>
                          <Sparkles className="h-3 w-3" style={{ color: historyItem.technicianColor }} />
                          <span>{historyItem.locationName}</span>
                        </p>
                        <p className="text-gray-500 underline mt-0.5">
                          {format(new Date(historyItem.startTime), "EEE, MMM d, yyyy, h:mm a")}
                        </p>
                        {historyItem.noShowProtected && (
                          <p className="text-gray-500 flex items-center gap-1 mt-1">
                            <Check className="h-3.5 w-3.5" />
                            <span>No-show protected</span>
                          </p>
                        )}
                      </button>
                      {index < appointmentHistory.length - 1 && (
                        <div className="h-px bg-gray-200 mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No appointment history</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Appointment Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Cancel Appointment</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Are you sure you want to cancel this appointment for{" "}
                <span className="font-medium">{appointment.client?.firstName} {appointment.client?.lastName}</span>?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {appointment.serviceName} on {format(appointment.startTime, "EEEE, MMMM d, yyyy")} at {format(appointment.startTime, "h:mm a")}
              </p>

              {hasCard && !appointment.noShowFeeCharged && (
                <label className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 cursor-pointer">
                  <Checkbox
                    checked={chargeFee}
                    onCheckedChange={(checked) => setChargeFee(checked === true)}
                    className="border-amber-400 data-[state=checked]:bg-amber-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Charge $25 late cancellation fee</p>
                    <p className="text-xs text-amber-700">
                      Card ending in {defaultCard?.last4} will be charged
                    </p>
                  </div>
                </label>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setChargeFee(false);
                }}
                disabled={processing}
                className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={processing}
                className="h-9 px-4 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark No-Show Confirmation Modal */}
      {showNoShowModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Mark as No-Show</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Mark{" "}
                <span className="font-medium">{appointment.client?.firstName} {appointment.client?.lastName}</span>{" "}
                as a no-show for this appointment?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {appointment.serviceName} on {format(appointment.startTime, "EEEE, MMMM d, yyyy")} at {format(appointment.startTime, "h:mm a")}
              </p>

              {hasCard && !appointment.noShowFeeCharged && (
                <label className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 cursor-pointer">
                  <Checkbox
                    checked={chargeFee}
                    onCheckedChange={(checked) => setChargeFee(checked === true)}
                    className="border-amber-400 data-[state=checked]:bg-amber-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Charge $25 no-show fee</p>
                    <p className="text-xs text-amber-700">
                      Card ending in {defaultCard?.last4} will be charged
                    </p>
                  </div>
                </label>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowNoShowModal(false);
                  setChargeFee(false);
                }}
                disabled={processing}
                className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleNoShowConfirm}
                disabled={processing}
                className="h-9 px-4 rounded-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark No-Show"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <RescheduleModal
          appointment={appointment}
          onClose={() => setShowRescheduleModal(false)}
          onReschedule={async (newStartTime, newEndTime) => {
            await onSave({
              status: editingStatus,
              notes: editingNotes,
              endTime: newEndTime,
            });
            // Note: The parent component should handle updating startTime via PATCH
            setShowRescheduleModal(false);
          }}
        />
      )}

      {/* Add Card Modal */}
      {showAddCardModal && appointment?.client && (
        <AddCardModal
          clientId={appointment.client.id}
          clientName={`${appointment.client.firstName} ${appointment.client.lastName}`}
          onClose={() => setShowAddCardModal(false)}
          onSuccess={async () => {
            if (onAddCard && appointment.client) {
              await onAddCard(appointment.client.id);
            }
            setShowAddCardModal(false);
          }}
        />
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && (
        <AddServiceModal
          locationId={appointment.location?.id}
          onClose={() => setShowAddServiceModal(false)}
          onAdd={async (service) => {
            await handleAddLineItem({
              itemType: "service",
              serviceId: service.id,
              name: service.name,
              unitPrice: service.price,
            });
            setShowAddServiceModal(false);
          }}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          onClose={() => setShowAddItemModal(false)}
          onAdd={async (item) => {
            await handleAddLineItem({
              itemType: "product",
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.price,
            });
            setShowAddItemModal(false);
          }}
        />
      )}

      {/* Add Discount Modal */}
      {showAddDiscountModal && (
        <AddDiscountModal
          subtotal={totals.subtotal}
          onClose={() => setShowAddDiscountModal(false)}
          onAdd={async (discount) => {
            await handleAddLineItem({
              itemType: "discount",
              name: discount.name,
              unitPrice: -discount.amount,
            });
            setShowAddDiscountModal(false);
          }}
        />
      )}

      {/* Recurring Appointment Modal */}
      {showRecurringModal && (
        <RecurringModal
          currentSettings={recurringSettings}
          onClose={() => setShowRecurringModal(false)}
          onSetup={handleSetupRecurring}
          onCancel={handleCancelRecurring}
          saving={savingRecurring}
        />
      )}
    </div>
  );
}

/**
 * Reschedule Modal Component
 */
interface RescheduleModalProps {
  appointment: Appointment;
  onClose: () => void;
  onReschedule: (newStartTime: Date, newEndTime: Date) => Promise<void>;
}

function RescheduleModal({ appointment, onClose, onReschedule }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState(format(appointment.startTime, "yyyy-MM-dd"));
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const duration = appointment.service?.durationMinutes ||
    Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000);

  useEffect(() => {
    fetchAvailability();
  }, [selectedDate]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/availability?date=${selectedDate}&technicianId=${appointment.technicianId}&locationId=${appointment.location?.id}&duration=${duration}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data.slots || []);
      }
    } catch (error) {
      console.error("Failed to fetch availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedTime) return;
    setSaving(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newStart = new Date(selectedDate);
      newStart.setHours(hours, minutes, 0, 0);
      const newEnd = new Date(newStart.getTime() + duration * 60000);
      await onReschedule(newStart, newEnd);
    } catch (error) {
      console.error("Failed to reschedule:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Find Availability</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Date selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg flex items-center">
              <DatePicker
                date={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                onDateChange={(date) => setSelectedDate(date ? format(date, "yyyy-MM-dd") : "")}
                minDate={new Date()}
                formatStr="EEE, MMM d, yyyy"
              />
            </div>
          </div>

          {/* Time slots */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Times for {appointment.technician?.firstName}
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
                {availableSlots.filter(slot => slot.available).map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer",
                      selectedTime === slot.time
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    )}
                  >
                    {format(new Date(`2000-01-01T${slot.time}`), "h:mm a")}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No available times on this date
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleReschedule}
            disabled={!selectedTime || saving}
            className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Add Card Modal Component
 */
interface AddCardModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

function AddCardModal({ clientId, clientName, onClose, onSuccess }: AddCardModalProps) {
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createSetupIntent();
  }, []);

  const createSetupIntent = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/setup-intent`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } else {
        setError("Failed to initialize card setup");
      }
    } catch (err) {
      console.error("Failed to create setup intent:", err);
      setError("Failed to initialize card setup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Card for {clientName}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : clientSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                To add a card, please use the client portal or the Stripe dashboard.
                Setup Intent created: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{clientSecret.slice(0, 20)}...</code>
              </p>
              <p className="text-sm text-gray-500">
                Full card element integration requires the Stripe.js Elements library.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Add Service Modal Component
 */
interface AddServiceModalProps {
  locationId?: string;
  onClose: () => void;
  onAdd: (service: ServiceOption) => Promise<void>;
}

function AddServiceModal({ locationId, onClose, onAdd }: AddServiceModalProps) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const url = locationId
        ? `/api/services?locationId=${locationId}`
        : "/api/services";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (service: ServiceOption) => {
    setAdding(true);
    try {
      await onAdd(service);
    } finally {
      setAdding(false);
    }
  };

  // Group services by category
  const servicesByCategory = filteredServices.reduce((acc, service) => {
    const cat = service.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {} as Record<string, ServiceOption[]>);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Service</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : Object.keys(servicesByCategory).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {categoryServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleAdd(service)}
                        disabled={adding}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer disabled:opacity-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{service.name}</p>
                          <p className="text-xs text-gray-500">{service.durationMinutes}min</p>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          ${service.price.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No services found
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Add Item Modal Component
 */
interface AddItemModalProps {
  onClose: () => void;
  onAdd: (item: { name: string; quantity: number; price: number }) => Promise<void>;
}

function AddItemModal({ onClose, onAdd }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    setAdding(true);
    try {
      await onAdd({
        name,
        quantity,
        price: parseFloat(price),
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Item</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lash Serum"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || !price || adding}
              className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Add Discount Modal Component
 */
interface AddDiscountModalProps {
  subtotal: number;
  onClose: () => void;
  onAdd: (discount: { name: string; amount: number }) => Promise<void>;
}

function AddDiscountModal({ subtotal, onClose, onAdd }: AddDiscountModalProps) {
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);

  const calculateAmount = () => {
    const numValue = parseFloat(value) || 0;
    if (discountType === "percent") {
      return (subtotal * numValue) / 100;
    }
    return numValue;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;

    const amount = calculateAmount();
    const name = reason || (discountType === "percent" ? `${value}% discount` : `$${value} discount`);

    setAdding(true);
    try {
      await onAdd({ name, amount });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Discount</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("fixed")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                  discountType === "fixed"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                )}
              >
                Fixed Amount ($)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                  discountType === "percent"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                )}
              >
                Percentage (%)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {discountType === "fixed" ? "Amount ($)" : "Percentage (%)"}
            </label>
            <Input
              type="number"
              min="0"
              step={discountType === "fixed" ? "0.01" : "1"}
              max={discountType === "percent" ? "100" : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={discountType === "fixed" ? "0.00" : "0"}
              required
            />
            {value && (
              <p className="text-sm text-gray-500 mt-1">
                Discount: ${calculateAmount().toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Loyal customer, First visit"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value || adding}
              className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Recurring Appointment Modal Component
 */
interface RecurringModalProps {
  currentSettings: RecurringSettings | null;
  onClose: () => void;
  onSetup: (pattern: "weekly" | "biweekly" | "every3weeks" | "monthly", occurrences: number) => Promise<void>;
  onCancel: (cancelAll: boolean) => Promise<void>;
  saving: boolean;
}

function RecurringModal({ currentSettings, onClose, onSetup, onCancel, saving }: RecurringModalProps) {
  const [pattern, setPattern] = useState<"weekly" | "biweekly" | "every3weeks" | "monthly">(
    currentSettings?.recurrencePattern || "biweekly"
  );
  const [occurrences, setOccurrences] = useState(currentSettings?.occurrences || 12);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const patternLabels = {
    weekly: "Every week",
    biweekly: "Every 2 weeks",
    every3weeks: "Every 3 weeks",
    monthly: "Every month",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSetup(pattern, occurrences);
  };

  if (showCancelConfirm) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Cancel Recurring</h3>
            <button onClick={() => setShowCancelConfirm(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">
              How would you like to cancel this recurring appointment?
            </p>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  await onCancel(false);
                  setShowCancelConfirm(false);
                  onClose();
                }}
                disabled={saving}
                className="w-full p-3 text-left rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <p className="text-sm font-medium text-gray-900">This appointment only</p>
                <p className="text-xs text-gray-500">Remove this appointment from the series</p>
              </button>

              <button
                onClick={async () => {
                  await onCancel(true);
                  setShowCancelConfirm(false);
                  onClose();
                }}
                disabled={saving}
                className="w-full p-3 text-left rounded-lg border border-red-300 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <p className="text-sm font-medium text-red-600">All future appointments</p>
                <p className="text-xs text-red-500">Cancel all future recurring appointments</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentSettings ? "Edit Recurring" : "Set Up Recurring"}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repeat frequency</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(patternLabels) as Array<keyof typeof patternLabels>).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPattern(key)}
                  className={cn(
                    "py-2 px-4 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                    pattern === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  )}
                >
                  {patternLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of appointments</label>
            <Select value={String(occurrences)} onValueChange={(v) => setOccurrences(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 6, 8, 10, 12, 16, 20, 24, 52].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num} appointments
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {pattern === "weekly" && `~${Math.round(occurrences / 4)} months`}
              {pattern === "biweekly" && `~${Math.round(occurrences / 2)} months`}
              {pattern === "every3weeks" && `~${Math.round((occurrences * 3) / 4)} months`}
              {pattern === "monthly" && `${occurrences} months`}
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            {currentSettings && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-sm text-red-600 hover:text-red-700 cursor-pointer"
              >
                Cancel recurring
              </button>
            )}
            <div className={cn("flex items-center gap-3", !currentSettings && "ml-auto")}>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : currentSettings ? "Update" : "Set Up Recurring"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
