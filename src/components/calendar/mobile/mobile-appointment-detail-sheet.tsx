"use client";

import { useState, useEffect } from "react";
import { format, addMinutes } from "date-fns";
import {
  X,
  Phone,
  MapPin,
  User,
  Loader2,
  Calendar,
  CalendarPlus,
  Pencil,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  serviceId?: string;
}

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
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

interface ClientInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface MobileAppointmentDetailSheetProps {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookNext?: (client: ClientInfo) => void;
  onStatusChange?: () => void;
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
  onBookNext,
  onStatusChange,
}: MobileAppointmentDetailSheetProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const { hideNav, showNav } = useMobileNav();

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTechnicianId, setEditTechnicianId] = useState("");
  const [editServices, setEditServices] = useState<Service[]>([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([]);

  // Hide/show bottom nav when sheet opens/closes
  useEffect(() => {
    if (open) {
      hideNav();
    } else {
      showNav();
      // Reset states when sheet closes
      setIsEditing(false);
      setShowCancelConfirm(false);
      setShowNoShowConfirm(false);
      setShowServicePicker(false);
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
      const res = await fetch(`/api/clients/${clientId}/appointments?limit=10`);
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

  const fetchAvailableServices = async () => {
    if (!appointment?.location?.id) return;
    try {
      const res = await fetch(`/api/services?locationId=${appointment.location.id}&includeLocations=true`);
      if (res.ok) {
        const data = await res.json();
        setAvailableServices(
          (data.services || []).filter((s: Service & { isActive?: boolean }) => s.isActive !== false)
        );
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    }
  };

  const fetchAvailableTechnicians = async () => {
    if (!appointment?.location?.id) return;
    try {
      const res = await fetch(`/api/technicians?locationId=${appointment.location.id}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTechnicians(data.technicians || []);
      }
    } catch (error) {
      console.error("Failed to fetch technicians:", error);
    }
  };

  const startEditing = () => {
    if (!appointment) return;
    setEditDate(format(appointment.startTime, "yyyy-MM-dd"));
    setEditTime(format(appointment.startTime, "HH:mm"));
    setEditTechnicianId(appointment.technician?.id || "");

    // Initialize services from line items or legacy service
    const services: Service[] = lineItems
      .filter((li) => li.itemType === "service")
      .map((li) => ({
        id: li.serviceId || li.id,
        name: li.name,
        category: "",
        durationMinutes: appointment.service?.durationMinutes || 60,
        price: li.unitPrice,
        depositAmount: 0,
      }));

    if (services.length === 0 && appointment.service) {
      services.push({
        id: appointment.service.id,
        name: appointment.service.name,
        category: "",
        durationMinutes: appointment.service.durationMinutes,
        price: appointment.service.price,
        depositAmount: 0,
      });
    }

    setEditServices(services);
    fetchAvailableServices();
    fetchAvailableTechnicians();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditDate("");
    setEditTime("");
    setEditTechnicianId("");
    setEditServices([]);
    setShowServicePicker(false);
  };

  const addService = (service: Service) => {
    if (!editServices.some((s) => s.id === service.id)) {
      setEditServices([...editServices, service]);
    }
    setShowServicePicker(false);
  };

  const removeService = (serviceId: string) => {
    if (editServices.length > 1) {
      setEditServices(editServices.filter((s) => s.id !== serviceId));
    }
  };

  const calculateEditTotal = () => {
    return editServices.reduce((sum, s) => sum + s.price, 0);
  };

  const calculateEditDuration = () => {
    return editServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  };

  const saveEdits = async () => {
    if (!appointment || editServices.length === 0) return;
    setIsSaving(true);
    try {
      const [hours, minutes] = editTime.split(":").map(Number);
      const newStartTime = new Date(editDate);
      newStartTime.setHours(hours, minutes, 0, 0);

      const totalDuration = calculateEditDuration();
      const newEndTime = addMinutes(newStartTime, totalDuration);

      const newLineItems = editServices.map((service) => ({
        itemType: "service" as const,
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        discountAmount: 0,
        totalAmount: service.price,
      }));

      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          technicianId: editTechnicianId,
          lineItems: newLineItems,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      // Update local state
      const selectedTech = availableTechnicians.find(t => t.id === editTechnicianId);
      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              startTime: newStartTime,
              endTime: newEndTime,
              technician: selectedTech ? {
                id: selectedTech.id,
                firstName: selectedTech.firstName,
                lastName: selectedTech.lastName,
                color: selectedTech.color,
              } : prev.technician,
            }
          : null
      );
      setLineItems(
        newLineItems.map((li, idx) => ({
          ...li,
          id: `temp-${idx}`,
        }))
      );
      setIsEditing(false);
      toast.success("Appointment updated");
      onStatusChange?.();
    } catch (error) {
      toast.error("Failed to update appointment");
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NO_SHOW" }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setAppointment((prev) => (prev ? { ...prev, status: "NO_SHOW" } : null));
      setShowNoShowConfirm(false);
      toast.success("Marked as no-show");
      onStatusChange?.();
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

  const handleBookNext = () => {
    if (appointment?.client && onBookNext) {
      onBookNext({
        id: appointment.client.id,
        firstName: appointment.client.firstName,
        lastName: appointment.client.lastName,
        phone: appointment.client.phone,
        email: appointment.client.email,
      });
      onOpenChange(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
  };

  const isTerminalStatus = appointment && ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status);

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
            {isEditing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-semibold">Edit</h1>
                <button
                  onClick={saveEdits}
                  disabled={isSaving}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-dusty-rose"
                >
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenChange(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
                <h1 className="text-lg font-semibold">Appointment</h1>
                {appointment && !isTerminalStatus ? (
                  <button
                    onClick={startEditing}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-dusty-rose"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="min-w-[44px]" />
                )}
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : appointment ? (
              <div className="space-y-3 p-4">
                {/* Status Badge - Display only */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge className={cn("font-medium", statusColors[appointment.status])}>
                    {statusLabels[appointment.status]}
                  </Badge>
                </div>

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
                        className="flex items-center gap-1.5 text-blue-600 text-sm"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {appointment.client?.phone ? formatPhone(appointment.client.phone) : ""}
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
                  {isEditing ? (
                    <>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-5" />
                        <Input
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <Select value={editTechnicianId} onValueChange={setEditTechnicianId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTechnicians.map((tech) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tech.color }}
                                  />
                                  {tech.firstName} {tech.lastName}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}

                  {appointment.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <span>{appointment.location.name}</span>
                    </div>
                  )}
                </div>

                {/* Services / Line Items */}
                <div className="bg-white rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-500">Services</h4>
                    {isEditing && (
                      <button
                        onClick={() => setShowServicePicker(true)}
                        className="flex items-center gap-1 text-sm text-dusty-rose font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {isEditing ? (
                      editServices.map((service) => (
                        <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{service.name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              ({formatDuration(service.durationMinutes)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">${service.price}</span>
                            {editServices.length > 1 && (
                              <button
                                onClick={() => removeService(service.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : lineItems.length > 0 ? (
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
                      ${isEditing ? calculateEditTotal() : lineItems.length > 0 ? calculateTotal() : appointment.service?.price || 0}
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

                {/* Past Appointments - Always visible */}
                {history.length > 0 && (
                  <div className="bg-white rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">
                      Past Appointments ({history.length})
                    </h4>
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: h.technicianColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{h.serviceName}</div>
                            <div className="text-gray-500">
                              {format(h.startTime, "MMM d, yyyy")}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn("text-xs flex-shrink-0", statusColors[h.status])}
                          >
                            {statusLabels[h.status]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom padding for footer */}
                <div className="h-4" />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Appointment not found
              </div>
            )}
          </div>

          {/* Footer - Cancel/No-Show/Book Next */}
          {appointment && !isEditing && !isTerminalStatus && (
            <div
              className="flex-shrink-0 p-4 bg-white border-t border-gray-200"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelConfirm(true)}
                  className="h-12 border-gray-300 text-gray-700"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNoShowConfirm(true)}
                  className="h-12 border-gray-300 text-gray-700"
                  disabled={isSaving}
                >
                  No-Show
                </Button>
              </div>
              {onBookNext && appointment.client && (
                <Button
                  onClick={handleBookNext}
                  className="w-full h-12 mt-3 bg-dusty-rose hover:bg-dusty-rose/90"
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Book Next
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 space-y-4">
            <h3 className="text-lg font-semibold text-center">Cancel Appointment?</h3>
            <p className="text-gray-600 text-center text-sm">
              This will cancel the appointment for {appointment?.client?.firstName}.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isSaving}
              >
                Keep
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12"
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
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-4 space-y-4">
            <h3 className="text-lg font-semibold text-center">Mark as No-Show?</h3>
            <p className="text-gray-600 text-center text-sm">
              {appointment?.client?.firstName} will be marked as a no-show.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowNoShowConfirm(false)}
                disabled={isSaving}
              >
                Go Back
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12"
                onClick={handleNoShow}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark No-Show"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Service Picker */}
      {showServicePicker && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: "70vh" }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Add Service</h3>
              <button
                onClick={() => setShowServicePicker(false)}
                className="p-2 -mr-2 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {availableServices.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading services...
                </div>
              ) : (
                <div className="space-y-2">
                  {availableServices
                    .filter((s) => !editServices.some((es) => es.id === s.id))
                    .map((service) => (
                      <button
                        key={service.id}
                        onClick={() => addService(service)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg active:bg-gray-100"
                      >
                        <div className="text-left">
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatDuration(service.durationMinutes)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${service.price}</div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div
              className="p-4 border-t border-gray-200"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => setShowServicePicker(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
