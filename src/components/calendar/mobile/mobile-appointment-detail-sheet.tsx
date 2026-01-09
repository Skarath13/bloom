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
  ChevronLeft,
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

// Types
type ViewState = 'view' | 'edit' | 'confirm-cancel' | 'confirm-noshow' | 'picking-service';

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface LineItem {
  id: string;
  itemType: "service" | "product" | "discount";
  name: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceId?: string;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  notes?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
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
  };
}

interface AppointmentHistory {
  id: string;
  serviceName: string;
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

interface Props {
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
}: Props) {
  // Core state
  const [viewState, setViewState] = useState<ViewState>('view');
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { hideNav, showNav } = useMobileNav();

  // Edit state
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTechId, setEditTechId] = useState("");
  const [editServices, setEditServices] = useState<Service[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [availableTechs, setAvailableTechs] = useState<Technician[]>([]);

  // Reset everything when sheet closes
  useEffect(() => {
    if (open) {
      hideNav();
    } else {
      showNav();
      setViewState('view');
      setAppointment(null);
      setLineItems([]);
      setHistory([]);
      setEditServices([]);
    }
    return () => showNav();
  }, [open, hideNav, showNav]);

  // Fetch appointment when opened
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
        const appt = {
          ...data.appointment,
          startTime: new Date(data.appointment.startTime),
          endTime: new Date(data.appointment.endTime),
        };
        setAppointment(appt);

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

  const fetchServicesAndTechs = async () => {
    if (!appointment?.location?.id) return;
    try {
      const [servRes, techRes] = await Promise.all([
        fetch(`/api/services?locationId=${appointment.location.id}`),
        fetch(`/api/technicians?locationId=${appointment.location.id}`),
      ]);

      if (servRes.ok) {
        const data = await servRes.json();
        setAvailableServices(data.services || []);
      }
      if (techRes.ok) {
        const data = await techRes.json();
        setAvailableTechs(data.technicians || []);
      }
    } catch (error) {
      console.error("Failed to fetch services/techs:", error);
    }
  };

  // Actions
  const handleClose = () => {
    if (viewState === 'edit' || viewState === 'picking-service') {
      setViewState('view');
    } else {
      onOpenChange(false);
    }
  };

  const startEdit = () => {
    if (!appointment) return;
    setEditDate(format(appointment.startTime, "yyyy-MM-dd"));
    setEditTime(format(appointment.startTime, "HH:mm"));
    setEditTechId(appointment.technician?.id || "");

    // Initialize services
    const services: Service[] = lineItems
      .filter((li) => li.itemType === "service")
      .map((li) => ({
        id: li.serviceId || li.id,
        name: li.name,
        durationMinutes: 60,
        price: li.unitPrice,
      }));

    if (services.length === 0 && appointment.service) {
      services.push({
        id: appointment.service.id,
        name: appointment.service.name,
        durationMinutes: appointment.service.durationMinutes,
        price: appointment.service.price,
      });
    }

    setEditServices(services);
    fetchServicesAndTechs();
    setViewState('edit');
  };

  const saveEdit = async () => {
    if (!appointment || editServices.length === 0) return;
    setIsSaving(true);
    try {
      const [hours, minutes] = editTime.split(":").map(Number);
      const newStart = new Date(editDate);
      newStart.setHours(hours, minutes, 0, 0);
      const totalDuration = editServices.reduce((sum, s) => sum + s.durationMinutes, 0);
      const newEnd = addMinutes(newStart, totalDuration);

      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          technicianId: editTechId,
          lineItems: editServices.map((s) => ({
            itemType: "service",
            serviceId: s.id,
            name: s.name,
            quantity: 1,
            unitPrice: s.price,
            discountAmount: 0,
            totalAmount: s.price,
          })),
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      // Update local state
      const selectedTech = availableTechs.find((t) => t.id === editTechId);
      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              startTime: newStart,
              endTime: newEnd,
              technician: selectedTech || prev.technician,
            }
          : null
      );
      setLineItems(
        editServices.map((s, i) => ({
          id: `temp-${i}`,
          itemType: "service" as const,
          name: s.name,
          quantity: 1,
          unitPrice: s.price,
          totalAmount: s.price,
          serviceId: s.id,
        }))
      );
      setViewState('view');
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
      setViewState('view');
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
      setViewState('view');
      toast.success("Marked as no-show");
      onStatusChange?.();
    } catch (error) {
      toast.error("Failed to mark as no-show");
    } finally {
      setIsSaving(false);
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

  const addService = (service: Service) => {
    if (!editServices.some((s) => s.id === service.id)) {
      setEditServices([...editServices, service]);
    }
    setViewState('edit');
  };

  const removeService = (id: string) => {
    if (editServices.length > 1) {
      setEditServices(editServices.filter((s) => s.id !== id));
    }
  };

  // Helpers
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const calculateTotal = () => lineItems.reduce((sum, li) => sum + li.totalAmount, 0);
  const calculateEditTotal = () => editServices.reduce((sum, s) => sum + s.price, 0);

  const isTerminal = appointment && ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status);

  if (!open) return null;

  // Header title and actions based on state
  const getHeaderTitle = () => {
    switch (viewState) {
      case 'edit': return 'Edit';
      case 'picking-service': return 'Add Service';
      default: return 'Appointment';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden"
        style={{ height: "100dvh" }}
      >
        <SheetTitle className="sr-only">Appointment Details</SheetTitle>
        <SheetDescription className="sr-only">View and manage appointment</SheetDescription>

        {/* HEADER */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <button
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            {viewState === 'picking-service' ? (
              <ChevronLeft className="h-6 w-6 text-gray-600" />
            ) : (
              <X className="h-6 w-6 text-gray-600" />
            )}
          </button>
          <span className="font-semibold text-lg">{getHeaderTitle()}</span>
          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2">
            {viewState === 'view' && appointment && !isTerminal && (
              <button onClick={startEdit} className="text-dusty-rose">
                <Pencil className="h-5 w-5" />
              </button>
            )}
            {viewState === 'edit' && (
              <button onClick={saveEdit} disabled={isSaving} className="text-dusty-rose">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
              </button>
            )}
          </div>
        </div>

        {/* ACTION BUTTONS - Under header */}
        {appointment && !isLoading && viewState === 'view' && !isTerminal && (
          <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewState('confirm-cancel')}
              className="flex-1 h-9"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewState('confirm-noshow')}
              className="flex-1 h-9"
            >
              No-Show
            </Button>
            {onBookNext && appointment.client && (
              <Button
                size="sm"
                onClick={handleBookNext}
                className="flex-1 h-9 bg-dusty-rose hover:bg-dusty-rose/90"
              >
                <CalendarPlus className="h-4 w-4 mr-1" />
                Book Next
              </Button>
            )}
          </div>
        )}

        {/* CONFIRM CANCEL - Under header */}
        {appointment && viewState === 'confirm-cancel' && (
          <div className="flex-shrink-0 px-4 py-3 bg-red-50 border-b border-red-100">
            <p className="text-center text-sm text-gray-700 mb-2">
              Cancel appointment for {appointment.client?.firstName}?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewState('view')} className="flex-1 h-9">
                Keep
              </Button>
              <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isSaving} className="flex-1 h-9">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel It"}
              </Button>
            </div>
          </div>
        )}

        {/* CONFIRM NO-SHOW - Under header */}
        {appointment && viewState === 'confirm-noshow' && (
          <div className="flex-shrink-0 px-4 py-3 bg-red-50 border-b border-red-100">
            <p className="text-center text-sm text-gray-700 mb-2">
              Mark {appointment.client?.firstName} as no-show?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewState('view')} className="flex-1 h-9">
                Go Back
              </Button>
              <Button variant="destructive" size="sm" onClick={handleNoShow} disabled={isSaving} className="flex-1 h-9">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark No-Show"}
              </Button>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !appointment ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              Appointment not found
            </div>
          ) : viewState === 'picking-service' ? (
            // SERVICE PICKER
            <div className="p-4 space-y-2">
              {availableServices.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                availableServices
                  .filter((s) => !editServices.some((es) => es.id === s.id))
                  .map((service) => (
                    <button
                      key={service.id}
                      onClick={() => addService(service)}
                      className="w-full flex items-center justify-between p-4 bg-white rounded-xl active:bg-gray-50"
                    >
                      <div className="text-left">
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-gray-500">{formatDuration(service.durationMinutes)}</div>
                      </div>
                      <div className="font-semibold">${service.price}</div>
                    </button>
                  ))
              )}
            </div>
          ) : (
            // VIEW / EDIT / CONFIRM STATES
            <div className="p-4 space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                <span className="text-sm text-gray-500">Status</span>
                <Badge className={cn("font-medium", statusColors[appointment.status])}>
                  {statusLabels[appointment.status]}
                </Badge>
              </div>

              {/* Client */}
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium"
                    style={{ backgroundColor: appointment.technician?.color || "#6B7280" }}
                  >
                    {appointment.client?.firstName?.[0]}
                    {appointment.client?.lastName?.[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {appointment.client?.firstName} {appointment.client?.lastName}
                    </h3>
                    <a
                      href={`tel:${appointment.client?.phone}`}
                      className="flex items-center gap-1.5 text-blue-600 text-sm"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {appointment.client?.phone ? formatPhone(appointment.client.phone) : ""}
                    </a>
                  </div>
                </div>
                {appointment.client?.notes && (
                  <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                    {appointment.client.notes}
                  </div>
                )}
              </div>

              {/* Date/Time/Tech/Location */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                {viewState === 'edit' ? (
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
                      <Select value={editTechId} onValueChange={setEditTechId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTechs.map((tech) => (
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
                        <div className="font-medium">{format(appointment.startTime, "EEEE, MMMM d, yyyy")}</div>
                        <div className="text-sm text-gray-500">
                          {format(appointment.startTime, "h:mm a")} - {format(appointment.endTime, "h:mm a")}
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
                        <span>{appointment.technician?.firstName} {appointment.technician?.lastName}</span>
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

              {/* Services */}
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-500">Services</h4>
                  {viewState === 'edit' && (
                    <button
                      onClick={() => setViewState('picking-service')}
                      className="flex items-center gap-1 text-sm text-dusty-rose font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {viewState === 'edit' ? (
                    editServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-500 text-sm ml-2">({formatDuration(s.durationMinutes)})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">${s.price}</span>
                          {editServices.length > 1 && (
                            <button onClick={() => removeService(s.id)} className="p-1 text-gray-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : lineItems.length > 0 ? (
                    lineItems.map((li) => (
                      <div key={li.id} className="flex justify-between">
                        <span className="font-medium">{li.name}</span>
                        <span>${li.totalAmount}</span>
                      </div>
                    ))
                  ) : appointment.service ? (
                    <div className="flex justify-between">
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
                <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>
                    ${viewState === 'edit' ? calculateEditTotal() : lineItems.length > 0 ? calculateTotal() : appointment.service?.price || 0}
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

              {/* Past Appointments */}
              {history.length > 0 && viewState !== 'edit' && (
                <div className="bg-white rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">
                    Past Appointments ({history.length})
                  </h4>
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: h.technicianColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{h.serviceName}</div>
                          <div className="text-gray-500">{format(h.startTime, "MMM d, yyyy")}</div>
                        </div>
                        <Badge variant="secondary" className={cn("text-xs flex-shrink-0", statusColors[h.status])}>
                          {statusLabels[h.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom padding */}
              <div className="h-4" />
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
}
