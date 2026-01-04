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

interface AppointmentDetailsDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (data: { status: string; notes: string }) => Promise<void>;
  onCancel: () => Promise<void>;
  onChargeNoShow: (amount: number, reason: string) => Promise<void>;
  onTakePayment?: () => void;
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
  saving = false,
}: AppointmentDetailsDialogProps) {
  const [editingNotes, setEditingNotes] = useState("");
  const [editingStatus, setEditingStatus] = useState("");
  const [originalNotes, setOriginalNotes] = useState("");
  const [originalStatus, setOriginalStatus] = useState("");
  const [appointmentHistory, setAppointmentHistory] = useState<AppointmentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [chargeFee, setChargeFee] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (appointment) {
      const notes = appointment.notes || "";
      setEditingNotes(notes);
      setOriginalNotes(notes);
      setEditingStatus(appointment.status);
      setOriginalStatus(appointment.status);
      fetchAppointmentHistory();
    }
  }, [appointment?.id]);

  // Check if there are unsaved changes
  const hasChanges = editingNotes !== originalNotes || editingStatus !== originalStatus;

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
    await onSave({ status: editingStatus, notes: editingNotes });
  };

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
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
        {/* Left: Close button */}
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        {/* Center: Title */}
        <h2 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-gray-900">
          Appointment Details
        </h2>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCancelModal(true)}
            className="h-9 px-4 rounded-full border border-red-300 hover:bg-red-50 text-sm font-medium text-red-600 transition-colors cursor-pointer"
          >
            Cancel Appointment
          </button>

          <button
            onClick={() => setShowNoShowModal(true)}
            className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
          >
            Mark No-Show
          </button>

          {onTakePayment && (
            <button
              onClick={onTakePayment}
              className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              Take payment
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={cn(
              "h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer",
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Content positioned closer to sidebar */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[820px] mx-auto py-10 px-6 translate-x-[160px]">
            {/* Client Information */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-normal text-gray-900">Client Information</h3>
                <span className={cn("text-sm font-medium", statusColors[appointment.status])}>
                  {statusLabels[appointment.status]}
                </span>
              </div>

              <div className="border border-gray-300 rounded">
                {/* Name row */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Name
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900 border-b border-gray-300">
                    {appointment.client?.firstName} {appointment.client?.lastName}
                  </div>
                </div>
                {/* Email & Phone row */}
                <div className="grid grid-cols-[200px_1fr_140px_1fr]">
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700">
                    Email
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900 truncate">
                    {appointment.client?.email || "—"}
                  </div>
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700 border-l border-gray-300">
                    Phone
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900">
                    {appointment.client?.phone ? formatPhone(appointment.client.phone) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-normal text-gray-900">Appointment Details</h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <Checkbox className="border-gray-400 data-[state=checked]:bg-gray-900 cursor-pointer" />
                    <span>All day</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed">
                    <Checkbox disabled className="opacity-50" />
                    <span>Repeat</span>
                  </label>
                </div>
              </div>

              <div className="border border-gray-300 rounded">
                {/* Date & time */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Date & time
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900 flex items-center justify-between border-b border-gray-300">
                    <div className="flex items-center gap-4">
                      <span>{format(appointment.startTime, "M/d/yy")}</span>
                      <span className="text-gray-400">at</span>
                      <span>{format(appointment.startTime, "h:mm a").toLowerCase()}</span>
                    </div>
                    <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 cursor-pointer">
                      <Search className="h-4 w-4" />
                      <span className="text-sm">Find availability</span>
                    </button>
                  </div>
                </div>
                {/* Location */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-300">
                    Location
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-900 border-b border-gray-300">
                    Elegant Lashes By Katie - {appointment.location?.name || "Unknown"} Location
                  </div>
                </div>
                {/* Appointment notes */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="px-4 py-3 bg-gray-100 text-sm font-medium text-gray-700">
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
              <div className="border border-gray-300 rounded overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_180px_100px] border-b-2 border-gray-300 bg-gray-50">
                  <div className="px-4 py-3 text-sm font-medium text-gray-900">Services</div>
                  <div className="px-4 py-3 text-sm font-medium text-gray-900">Duration</div>
                  <div className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
                </div>

                {/* Service row */}
                <div className="grid grid-cols-[1fr_180px_100px] border-b border-gray-300">
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
                    <Select defaultValue={String(appointment.service?.durationMinutes || 60)}>
                      <SelectTrigger className="w-28 h-10 text-sm border-gray-300 bg-white">
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

                {/* Add a service row */}
                <div className="px-4 py-3">
                  <button className="text-sm text-gray-700 hover:text-gray-900 cursor-pointer">
                    Add a service
                  </button>
                </div>
              </div>
              {/* X button outside table - absolutely positioned */}
              <button className="absolute -right-8 top-14 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Items Table */}
            <div className="mb-6 border border-gray-300 rounded overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_150px_100px_100px] border-b-2 border-gray-300 bg-gray-50">
                <div className="px-4 py-3 text-sm font-medium text-gray-900">Items</div>
                <div className="px-4 py-3 text-sm font-medium text-gray-900">Quantity</div>
                <div className="px-4 py-3 text-sm font-medium text-gray-900">Price</div>
                <div className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
              </div>

              {/* Add an item row */}
              <div className="px-4 py-3">
                <button className="text-sm text-gray-700 hover:text-gray-900 cursor-pointer">
                  Add an item
                </button>
              </div>
            </div>

            {/* Totals */}
            <div className="border border-gray-300 rounded overflow-hidden">
              {/* Add discount row */}
              <div className="grid grid-cols-[1fr_1fr]">
                <div className="bg-gray-100 border-r border-gray-300 min-h-[44px]"></div>
                <div className="px-4 py-3 border-b border-gray-300">
                  <button className="text-sm text-gray-900 underline hover:no-underline font-medium cursor-pointer">
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
                    ${(appointment.service?.price || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[320px] min-w-[320px] border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-6">
            {/* Client Name */}
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {appointment.client?.firstName} {appointment.client?.lastName}
            </h3>

            {/* Client Notes */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Client Notes</span>
                <button className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">Add a note</button>
              </div>
              <p className="text-sm text-gray-400 italic">
                {appointment.client?.notes || "No notes for this client"}
              </p>
            </div>

            <div className="h-px bg-gray-200 my-5" />

            {/* Cards on File */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Cards on File</span>
                <button className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">Add card</button>
              </div>
              {hasCard ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {defaultCard?.brand}
                    </span>
                    <span className="text-sm text-gray-700">ending in {defaultCard?.last4}</span>
                  </div>
                  <button className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
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
                      <div className="text-sm">
                        <p className="text-blue-600 hover:underline cursor-pointer leading-snug select-none">
                          {historyItem.serviceName}
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
                      </div>
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
                className="h-9 px-4 rounded-full bg-red-600 hover:bg-red-700 text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer"
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
                className="h-9 px-4 rounded-full bg-amber-600 hover:bg-amber-700 text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark No-Show"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
