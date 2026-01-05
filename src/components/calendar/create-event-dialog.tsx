"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addMinutes } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Info,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface Location {
  id: string;
  name: string;
  slug: string;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  locationId: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  stripeCustomerId?: string;
  paymentMethods?: PaymentMethod[];
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

interface ServiceLineItem {
  id: string;
  service: Service;
  durationMinutes: number;
}

interface ItemLineItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  technicianName: string;
  technicianColor: string;
  locationId: string;
  locationName: string;
  time: Date;
  locations: Location[];
  technicians: Technician[];
  onSuccess: () => void;
}

type EventType = "appointment" | "personal_event";

interface RepetitionSettings {
  enabled: boolean;
  interval: number;
  frequency: "day" | "week" | "month";
  ends: "never" | "after" | "on_date";
  endAfterOccurrences?: number;
  endDate?: string;
}

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

export function CreateEventDialog({
  open,
  onClose,
  technicianId,
  technicianName,
  technicianColor,
  locationId,
  locationName,
  time,
  locations,
  technicians,
  onSuccess,
}: CreateEventDialogProps) {
  // Event type state
  const [eventType, setEventType] = useState<EventType>("appointment");

  // Appointment state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  // Appointment details
  const [selectedLocationId, setSelectedLocationId] = useState(locationId);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(technicianId);
  const [appointmentDate, setAppointmentDate] = useState(format(time, "yyyy-MM-dd"));
  const [appointmentTime, setAppointmentTime] = useState(format(time, "HH:mm"));
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatFrequency, setRepeatFrequency] = useState<"day" | "week" | "month">("week");
  const [repeatEnds, setRepeatEnds] = useState<"never" | "after" | "on_date">("never");
  const [repeatEndAfter, setRepeatEndAfter] = useState<number>(10);
  const [repeatEndDate, setRepeatEndDate] = useState("");

  // Services and items
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceLineItem[]>([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [items, setItems] = useState<ItemLineItem[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: "", quantity: 1, price: "" });
  const [discount, setDiscount] = useState<{ name: string; amount: number } | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: "fixed" as "fixed" | "percent", value: "", name: "" });

  // Personal event state
  const [eventTitle, setEventTitle] = useState("");
  const [blockTime, setBlockTime] = useState(true);
  const [personalEventAllDay, setPersonalEventAllDay] = useState(false);
  const [startDate, setStartDate] = useState(format(time, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(time, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(time, "HH:mm"));
  const [endTime, setEndTime] = useState(format(addMinutes(time, 15), "HH:mm"));

  // Repetition settings
  const [repetition, setRepetition] = useState<RepetitionSettings>({
    enabled: false,
    interval: 1,
    frequency: "week",
    ends: "never",
  });
  const [showRepetitionModal, setShowRepetitionModal] = useState(false);

  // Conflict checking
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  // Submission state
  const [saving, setSaving] = useState(false);

  // Validation - check if form can be saved
  const canSave = eventType === "appointment"
    ? selectedClient !== null && selectedServices.length > 0
    : eventTitle.trim().length > 0;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setEventType("appointment");
      setSelectedClient(null);
      setClientSearchQuery("");
      setClientSearchResults([]);
      setShowClientSearch(false);
      setShowNewClientForm(false);
      setNewClientForm({ firstName: "", lastName: "", phone: "", email: "" });
      setSelectedLocationId(locationId);
      setSelectedTechnicianId(technicianId);
      setAppointmentDate(format(time, "yyyy-MM-dd"));
      setAppointmentTime(format(time, "HH:mm"));
      setAppointmentNotes("");
      setRepeat(false);
      setRepeatInterval(1);
      setRepeatFrequency("week");
      setRepeatEnds("never");
      setRepeatEndAfter(10);
      setRepeatEndDate("");
      setSelectedServices([]);
      setItems([]);
      setDiscount(null);
      setEventTitle("");
      setBlockTime(true);
      setPersonalEventAllDay(false);
      setStartDate(format(time, "yyyy-MM-dd"));
      setEndDate(format(time, "yyyy-MM-dd"));
      setStartTime(format(time, "HH:mm"));
      setEndTime(format(addMinutes(time, 15), "HH:mm"));
      setRepetition({ enabled: false, interval: 1, frequency: "week", ends: "never" });
      setHasConflict(false);
      setConflictMessage("");
      fetchServices();
    }
  }, [open, locationId, technicianId, time]);

  // Fetch services when location changes
  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const response = await fetch(`/api/services?locationId=${selectedLocationId}`);
      const data = await response.json();
      if (data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setLoadingServices(false);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (open && selectedLocationId) {
      fetchServices();
    }
  }, [selectedLocationId, fetchServices, open]);

  // Check for conflicts when time/technician changes for personal events
  useEffect(() => {
    if (eventType === "personal_event" && selectedTechnicianId) {
      checkConflicts();
    }
  }, [eventType, selectedTechnicianId, startDate, startTime, endDate, endTime, personalEventAllDay]);

  const checkConflicts = async () => {
    // Simple conflict check - could be expanded
    setHasConflict(false);
    setConflictMessage("");
  };

  // Client search
  const handleClientSearch = async () => {
    if (!clientSearchQuery.trim()) return;
    setSearchingClients(true);
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(clientSearchQuery)}`);
      const data = await response.json();
      setClientSearchResults(data.clients || []);
    } catch (error) {
      console.error("Client search error:", error);
      toast.error("Failed to search clients");
    } finally {
      setSearchingClients(false);
    }
  };

  // Create new client
  const handleCreateClient = async () => {
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreatingClient(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newClientForm.firstName,
          lastName: newClientForm.lastName,
          phone: newClientForm.phone.replace(/\D/g, ""),
          email: newClientForm.email || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create client");
      }
      const data = await response.json();
      setSelectedClient(data.client);
      setShowNewClientForm(false);
      setShowClientSearch(false);
    } catch (error) {
      console.error("Create client error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setCreatingClient(false);
    }
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Handle phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 10) value = value.slice(0, 10);
    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }
    setNewClientForm((prev) => ({ ...prev, phone: value }));
  };

  // Add service to appointment
  const handleAddService = (service: Service) => {
    const newItem: ServiceLineItem = {
      id: `service-${Date.now()}`,
      service,
      durationMinutes: service.durationMinutes,
    };
    setSelectedServices((prev) => [...prev, newItem]);
    setShowServicePicker(false);
  };

  // Remove service
  const handleRemoveService = (id: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Add item
  const handleAddItem = () => {
    if (!newItemForm.name || !newItemForm.price) return;
    const newItem: ItemLineItem = {
      id: `item-${Date.now()}`,
      name: newItemForm.name,
      quantity: newItemForm.quantity,
      price: parseFloat(newItemForm.price),
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemForm({ name: "", quantity: 1, price: "" });
    setShowItemForm(false);
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Add discount
  const handleAddDiscount = () => {
    if (!discountForm.value) return;
    const value = parseFloat(discountForm.value);
    const amount = discountForm.type === "percent" ? (calculateSubtotal() * value) / 100 : value;
    const name = discountForm.name || (discountForm.type === "percent" ? `${value}% discount` : `$${value} discount`);
    setDiscount({ name, amount });
    setDiscountForm({ type: "fixed", value: "", name: "" });
    setShowDiscountForm(false);
  };

  // Calculate totals
  const calculateSubtotal = () => {
    const servicesTotal = selectedServices.reduce((sum, s) => sum + s.service.price, 0);
    const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return servicesTotal + itemsTotal;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - (discount?.amount || 0);
  };

  // Get filtered technicians for selected location
  const filteredTechnicians = technicians.filter((t) => t.locationId === selectedLocationId);

  // Save appointment
  const handleSaveAppointment = async () => {
    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Please add at least one service");
      return;
    }

    setSaving(true);
    try {
      // Use the first service as the primary service
      const primaryService = selectedServices[0].service;
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

      const startDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
      const endDateTime = addMinutes(startDateTime, totalDuration);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          technicianId: selectedTechnicianId,
          locationId: selectedLocationId,
          serviceId: primaryService.id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          status: "CONFIRMED",
          notes: appointmentNotes || undefined,
          noShowProtected: !!selectedClient.paymentMethods?.length,
          bookedBy: "Admin",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create appointment");
      }

      toast.success("Appointment created successfully");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Create appointment error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create appointment");
    } finally {
      setSaving(false);
    }
  };

  // Save personal event
  const handleSavePersonalEvent = async () => {
    if (!eventTitle.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    setSaving(true);
    try {
      const startDateTime = personalEventAllDay
        ? new Date(`${startDate}T00:00:00`)
        : new Date(`${startDate}T${startTime}`);
      const endDateTime = personalEventAllDay
        ? new Date(`${endDate}T23:59:59`)
        : new Date(`${endDate}T${endTime}`);

      // Build recurrence rule if repetition is enabled
      let recurrenceRule = null;
      if (repetition.enabled) {
        const freq = repetition.frequency.toUpperCase();
        recurrenceRule = `FREQ=${freq};INTERVAL=${repetition.interval}`;
        if (repetition.ends === "after" && repetition.endAfterOccurrences) {
          recurrenceRule += `;COUNT=${repetition.endAfterOccurrences}`;
        } else if (repetition.ends === "on_date" && repetition.endDate) {
          recurrenceRule += `;UNTIL=${repetition.endDate.replace(/-/g, "")}`;
        }
      }

      // Format as local time string (YYYY-MM-DDTHH:mm:ss) to avoid timezone conversion
      const formatLocalDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      const response = await fetch("/api/technician-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: selectedTechnicianId,
          title: eventTitle,
          blockType: "PERSONAL",
          startTime: formatLocalDateTime(startDateTime),
          endTime: formatLocalDateTime(endDateTime),
          recurrenceRule,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create personal event");
      }

      toast.success("Personal event created successfully");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Create personal event error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create personal event");
    } finally {
      setSaving(false);
    }
  };

  // Handle save
  const handleSave = () => {
    if (eventType === "appointment") {
      handleSaveAppointment();
    } else {
      handleSavePersonalEvent();
    }
  };

  // Get current technician
  const currentTechnician = technicians.find((t) => t.id === selectedTechnicianId);

  if (!open) return null;

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
          {eventType === "appointment" ? "Create Appointment" : "Create Personal Event"}
        </h2>

        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="h-9 px-6 rounded-full bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto py-8 px-6 ${eventType === "appointment" ? "max-w-4xl" : "max-w-lg"}`}>
          {/* Event Type Selector */}
          <div className="border border-gray-300 rounded-lg mb-8 overflow-hidden">
            <div className={`grid ${eventType === "appointment" ? "grid-cols-[200px_1fr]" : ""}`}>
              <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
                Event type
              </div>
              <div className="px-2 py-1">
                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                  <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 h-10 text-sm justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="personal_event">Personal event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Appointment Form */}
          {eventType === "appointment" && (
            <>
              {/* Client Information */}
              <div className="mb-6">
                <h3 className="text-base font-medium text-gray-900 mb-3">Client information</h3>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* Name row */}
                  <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Name</div>
                    <div className="px-4 py-3">
                      {selectedClient ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900">
                            {selectedClient.firstName} {selectedClient.lastName}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedClient(null);
                              setShowClientSearch(true);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      ) : showClientSearch || showNewClientForm ? (
                        <div className="space-y-3">
                          {showNewClientForm ? (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <button
                                  onClick={() => {
                                    setShowNewClientForm(false);
                                    setShowClientSearch(true);
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                                >
                                  Back to search
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <Input
                                  placeholder="First name *"
                                  value={newClientForm.firstName}
                                  onChange={(e) => setNewClientForm((p) => ({ ...p, firstName: e.target.value }))}
                                />
                                <Input
                                  placeholder="Last name *"
                                  value={newClientForm.lastName}
                                  onChange={(e) => setNewClientForm((p) => ({ ...p, lastName: e.target.value }))}
                                />
                              </div>
                              <Input
                                placeholder="Phone number *"
                                value={newClientForm.phone}
                                onChange={handlePhoneChange}
                              />
                              <Input
                                placeholder="Email (optional)"
                                type="email"
                                value={newClientForm.email}
                                onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))}
                              />
                              <button
                                onClick={handleCreateClient}
                                disabled={creatingClient}
                                className="w-full h-9 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {creatingClient ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Create Client"}
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Search by name or phone..."
                                  value={clientSearchQuery}
                                  onChange={(e) => setClientSearchQuery(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleClientSearch()}
                                />
                                <button
                                  onClick={handleClientSearch}
                                  disabled={searchingClients}
                                  className="h-9 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                                >
                                  {searchingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </button>
                              </div>
                              {clientSearchResults.length > 0 && (
                                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                                  {clientSearchResults.map((client) => (
                                    <button
                                      key={client.id}
                                      onClick={() => {
                                        setSelectedClient(client);
                                        setShowClientSearch(false);
                                        setClientSearchResults([]);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-100 active:bg-gray-200 text-sm border-b border-gray-100 last:border-b-0 transition-colors cursor-pointer"
                                    >
                                      <div className="font-medium">{client.firstName} {client.lastName}</div>
                                      <div className="text-gray-500">{formatPhone(client.phone)}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => setShowNewClientForm(true)}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                              >
                                <Plus className="h-4 w-4" />
                                Create new client
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowClientSearch(true)}
                          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          Select or create client
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Email & Phone row */}
                  <div className="grid grid-cols-[200px_1fr_160px_1fr]">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Email</div>
                    <div className="px-4 py-3 text-sm text-gray-400">
                      {selectedClient?.email || "Email"}
                    </div>
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 border-l border-gray-300">
                      Phone
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-400">
                      {selectedClient ? formatPhone(selectedClient.phone) : "Primary phone number"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium text-gray-900">Appointment details</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={repeat}
                      onCheckedChange={(c) => setRepeat(c === true)}
                    />
                    <span className="text-sm text-gray-700">Repeat</span>
                  </label>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* Date & time */}
                  <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Date & time</div>
                    <div className="px-4 py-3 flex items-center gap-2">
                      <DatePicker
                        date={appointmentDate ? new Date(appointmentDate + "T00:00:00") : undefined}
                        onDateChange={(date) => setAppointmentDate(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                      <span className="text-gray-400">at</span>
                      <TimePicker
                        time={appointmentTime}
                        onTimeChange={setAppointmentTime}
                      />
                    </div>
                  </div>
                  {/* Repeat every - shown when repeat is checked */}
                  {repeat && (
                    <>
                      <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                        <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Repeat every</div>
                        <div className="px-4 py-3 flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={repeatInterval}
                            onChange={(e) => setRepeatInterval(parseInt(e.target.value) || 1)}
                            className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                          />
                          <Select value={repeatFrequency} onValueChange={(v) => setRepeatFrequency(v as "day" | "week" | "month")}>
                            <SelectTrigger className="w-28 h-8 text-sm">
                              <SelectValue>
                                {repeatFrequency === "day" && (repeatInterval === 1 ? "Day" : "Days")}
                                {repeatFrequency === "week" && (repeatInterval === 1 ? "Week" : "Weeks")}
                                {repeatFrequency === "month" && (repeatInterval === 1 ? "Month" : "Months")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">{repeatInterval === 1 ? "Day" : "Days"}</SelectItem>
                              <SelectItem value="week">{repeatInterval === 1 ? "Week" : "Weeks"}</SelectItem>
                              <SelectItem value="month">{repeatInterval === 1 ? "Month" : "Months"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                        <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">End repeating</div>
                        <div className="px-2 py-1 flex items-center gap-2">
                          <Select value={repeatEnds} onValueChange={(v) => setRepeatEnds(v as "never" | "after" | "on_date")}>
                            <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 h-10 text-sm justify-between">
                              <SelectValue>
                                {repeatEnds === "never" && "Never"}
                                {repeatEnds === "after" && `After ${repeatEndAfter} occurrences`}
                                {repeatEnds === "on_date" && (repeatEndDate ? format(new Date(repeatEndDate), "MMM d, yyyy") : "On date")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="never">Never</SelectItem>
                              <SelectItem value="after">After X occurrences</SelectItem>
                              <SelectItem value="on_date">On date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {repeatEnds === "after" && (
                        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                          <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Occurrences</div>
                          <div className="px-4 py-3">
                            <input
                              type="number"
                              min="1"
                              value={repeatEndAfter}
                              onChange={(e) => setRepeatEndAfter(parseInt(e.target.value) || 1)}
                              className="w-20 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                            />
                          </div>
                        </div>
                      )}
                      {repeatEnds === "on_date" && (
                        <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                          <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">End date</div>
                          <div className="px-4 py-3">
                            <DatePicker
                              date={repeatEndDate ? new Date(repeatEndDate + "T00:00:00") : undefined}
                              onDateChange={(date) => setRepeatEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                              minDate={appointmentDate ? new Date(appointmentDate + "T00:00:00") : undefined}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* Location */}
                  <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Location</div>
                    <div className="px-2 py-1">
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                        <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 h-10 text-sm justify-between">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              Elegant Lashes By Katie - {loc.name} Location
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Staff */}
                  <div className="grid grid-cols-[200px_1fr] border-b border-gray-300">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Staff</div>
                    <div className="px-2 py-1">
                      <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                        <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 h-10 text-sm justify-between">
                          <SelectValue>
                            {currentTechnician && (
                              <div className="flex items-center gap-2">
                                <span>{currentTechnician.firstName} {currentTechnician.lastName}</span>
                                <Sparkles className="h-3 w-3" style={{ color: currentTechnician.color }} />
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {technicians
                            .filter((tech) => tech.locationId === selectedLocationId)
                            .map((tech) => (
                              <SelectItem key={tech.id} value={tech.id}>
                                <div className="flex items-center gap-2">
                                  <span>{tech.firstName} {tech.lastName}</span>
                                  <Sparkles className="h-3 w-3" style={{ color: tech.color }} />
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Notes */}
                  <div className="grid grid-cols-[200px_1fr]">
                    <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">Appointment notes</div>
                    <div className="px-2 py-1">
                      <Input
                        value={appointmentNotes}
                        onChange={(e) => setAppointmentNotes(e.target.value)}
                        placeholder="Add notes viewable by staff only (optional)"
                        className="border-0 shadow-none focus-visible:ring-0 h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Table */}
              <div className="mb-4">
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_100px] bg-gray-50 border-b-2 border-gray-300">
                    <div className="px-4 py-3 text-sm font-medium text-gray-900">Services</div>
                    <div className="px-4 py-3 text-sm font-medium text-gray-900">Duration</div>
                    <div className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
                  </div>
                  {selectedServices.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_120px_100px] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-900">{item.service.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {currentTechnician?.firstName}
                            <Sparkles className="h-3 w-3" style={{ color: currentTechnician?.color }} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveService(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-300">
                        {item.durationMinutes}min
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-900 text-right border-l border-gray-300">
                        ${item.service.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <button
                      onClick={() => setShowServicePicker(true)}
                      className="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                    >
                      Add a service
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_80px_80px_100px] bg-gray-50 border-b-2 border-gray-300">
                    <div className="px-4 py-3 text-sm font-medium text-gray-900">Items</div>
                    <div className="px-4 py-3 text-sm font-medium text-gray-900">Quantity</div>
                    <div className="px-4 py-3 text-sm font-medium text-gray-900">Price</div>
                    <div className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Amount</div>
                  </div>
                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_80px_100px] border-b border-gray-300 group hover:bg-gray-50 transition-colors">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-900">{item.name}</span>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-300">{item.quantity}</div>
                      <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-300">${item.price.toFixed(2)}</div>
                      <div className="px-4 py-3 text-sm text-gray-900 text-right border-l border-gray-300">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    {showItemForm ? (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Item name"
                          value={newItemForm.name}
                          onChange={(e) => setNewItemForm((p) => ({ ...p, name: e.target.value }))}
                          className="flex-1 h-8 text-sm"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={newItemForm.quantity}
                          onChange={(e) => setNewItemForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                          className="w-16 h-8 text-sm"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={newItemForm.price}
                          onChange={(e) => setNewItemForm((p) => ({ ...p, price: e.target.value }))}
                          className="w-20 h-8 text-sm"
                        />
                        <button onClick={handleAddItem} className="h-8 px-3 bg-gray-900 text-white text-sm rounded cursor-pointer">
                          Add
                        </button>
                        <button onClick={() => setShowItemForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowItemForm(true)}
                        className="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 px-2 py-1 -mx-2 rounded transition-colors cursor-pointer"
                      >
                        Add an item
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {discount && (
                  <div className="grid grid-cols-[1fr_1fr] border-b border-gray-300">
                    <div className="bg-gray-50 border-r border-gray-300 min-h-[44px]" />
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{discount.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-600">-${discount.amount.toFixed(2)}</span>
                        <button onClick={() => setDiscount(null)} className="text-gray-400 hover:text-red-500 cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_1fr] border-b border-gray-300">
                  <div className="bg-gray-50 border-r border-gray-300 min-h-[44px]" />
                  <div className="px-4 py-3">
                    {showDiscountForm ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={discountForm.type}
                          onChange={(e) => setDiscountForm((p) => ({ ...p, type: e.target.value as "fixed" | "percent" }))}
                          className="h-8 text-sm border border-gray-300 rounded px-2"
                        >
                          <option value="fixed">$</option>
                          <option value="percent">%</option>
                        </select>
                        <Input
                          type="number"
                          step={discountForm.type === "fixed" ? "0.01" : "1"}
                          placeholder={discountForm.type === "fixed" ? "0.00" : "0"}
                          value={discountForm.value}
                          onChange={(e) => setDiscountForm((p) => ({ ...p, value: e.target.value }))}
                          className="w-20 h-8 text-sm"
                        />
                        <Input
                          placeholder="Reason (optional)"
                          value={discountForm.name}
                          onChange={(e) => setDiscountForm((p) => ({ ...p, name: e.target.value }))}
                          className="flex-1 h-8 text-sm"
                        />
                        <button onClick={handleAddDiscount} className="h-8 px-3 bg-gray-900 text-white text-sm rounded cursor-pointer">
                          Add
                        </button>
                        <button onClick={() => setShowDiscountForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDiscountForm(true)}
                        className="text-sm text-gray-900 underline hover:no-underline font-medium cursor-pointer"
                      >
                        Add discount
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_1fr]">
                  <div className="bg-gray-50 border-r border-gray-300 min-h-[44px]" />
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Total</span>
                    <span className="text-sm font-medium text-gray-900">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Personal Event Form */}
          {eventType === "personal_event" && (
            <>
              {/* Event Title */}
              <div className="mb-6">
                <Input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="text-lg h-12 border-gray-300"
                />
              </div>

              <div className="border-t border-gray-300 pt-6 mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Date and time</h3>

                {/* Conflict Warning */}
                {hasConflict && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <span className="text-sm text-amber-800">{conflictMessage || `Conflicts with events on ${currentTechnician?.firstName}'s calendar.`}</span>
                  </div>
                )}

                {/* Checkboxes */}
                <div className="flex items-center gap-6 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={blockTime} onCheckedChange={(c) => setBlockTime(c === true)} />
                    <span className="text-sm text-gray-700">Block time</span>
                    <Info className="h-4 w-4 text-gray-400" />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={personalEventAllDay} onCheckedChange={(c) => setPersonalEventAllDay(c === true)} />
                    <span className="text-sm text-gray-700">All day</span>
                  </label>
                </div>

                {/* Date/Time Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start date</label>
                    <div className="w-full h-10 px-3 border border-gray-300 rounded-lg flex items-center">
                      <DatePicker
                        date={startDate ? new Date(startDate + "T00:00:00") : undefined}
                        onDateChange={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                        formatStr="EEE, MMM d, yyyy"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End date</label>
                    <div className="w-full h-10 px-3 border border-gray-300 rounded-lg flex items-center">
                      <DatePicker
                        date={endDate ? new Date(endDate + "T00:00:00") : undefined}
                        onDateChange={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                        minDate={startDate ? new Date(startDate + "T00:00:00") : undefined}
                        formatStr="EEE, MMM d, yyyy"
                      />
                    </div>
                  </div>
                </div>

                {!personalEventAllDay && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start time</label>
                      <div className="w-full h-10 px-3 border border-gray-300 rounded-lg flex items-center">
                        <TimePicker
                          time={startTime}
                          onTimeChange={setStartTime}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End time</label>
                      <div className="w-full h-10 px-3 border border-gray-300 rounded-lg flex items-center">
                        <TimePicker
                          time={endTime}
                          onTimeChange={setEndTime}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Repeats */}
                <button
                  onClick={() => setShowRepetitionModal(true)}
                  className="w-full flex items-center justify-between py-3 text-sm cursor-pointer"
                >
                  <span className="text-gray-700">Repeats</span>
                  <div className="flex items-center gap-1 text-gray-500">
                    <span>
                      {repetition.enabled
                        ? `Every ${repetition.interval} ${repetition.frequency}${repetition.interval > 1 ? "s" : ""}`
                        : "Set repetition"}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              </div>

              {/* Staff Details */}
              <div className="border-t border-gray-300 pt-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Staff details</h3>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Staff</label>
                  <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                    <SelectTrigger className="h-10 w-full justify-between">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          <div className="flex items-center gap-2">
                            <span>{tech.firstName}</span>
                            <Sparkles className="h-4 w-4" style={{ color: tech.color }} />
                            <span className="text-gray-500">
                              {locations.find((l) => l.id === tech.locationId)?.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Service Picker Modal */}
      {showServicePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Service</h3>
              <button onClick={() => setShowServicePicker(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingServices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : services.length > 0 ? (
                <div className="space-y-1">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleAddService(service)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-left cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-500">{service.durationMinutes}min</p>
                      </div>
                      <span className="text-sm font-medium text-gray-900">${service.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No services available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Repetition Settings Modal */}
      {showRepetitionModal && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
            <button
              onClick={() => setShowRepetitionModal(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowRepetitionModal(false)}
              className="h-9 px-6 rounded-full bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto py-8 px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Set repetition</h2>

              {/* Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
                <span className="text-sm font-medium text-gray-900">Repeat personal event</span>
                <Switch
                  checked={repetition.enabled}
                  onCheckedChange={(checked) => setRepetition((p) => ({ ...p, enabled: checked }))}
                />
              </div>

              {repetition.enabled && (
                <>
                  {/* Repeat every */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-3">Repeat every</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Interval</label>
                        <Input
                          type="number"
                          min="1"
                          value={repetition.interval}
                          onChange={(e) => setRepetition((p) => ({ ...p, interval: parseInt(e.target.value) || 1 }))}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                        <Select
                          value={repetition.frequency}
                          onValueChange={(v) => setRepetition((p) => ({ ...p, frequency: v as "day" | "week" | "month" }))}
                        >
                          <SelectTrigger className="h-10 w-full justify-between">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="week">Week</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Ends */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ends</label>
                    <Select
                      value={repetition.ends}
                      onValueChange={(v) => setRepetition((p) => ({ ...p, ends: v as "never" | "after" | "on_date" }))}
                    >
                      <SelectTrigger className="h-10 w-full justify-between">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="after">After X occurrences</SelectItem>
                        <SelectItem value="on_date">On date</SelectItem>
                      </SelectContent>
                    </Select>

                    {repetition.ends === "after" && (
                      <div className="mt-3">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Number of occurrences"
                          value={repetition.endAfterOccurrences || ""}
                          onChange={(e) =>
                            setRepetition((p) => ({ ...p, endAfterOccurrences: parseInt(e.target.value) || undefined }))
                          }
                          className="h-10"
                        />
                      </div>
                    )}

                    {repetition.ends === "on_date" && (
                      <div className="mt-3">
                        <div className="w-full h-10 px-3 border border-gray-300 rounded-lg flex items-center">
                          <DatePicker
                            date={repetition.endDate ? new Date(repetition.endDate + "T00:00:00") : undefined}
                            onDateChange={(date) => setRepetition((p) => ({ ...p, endDate: date ? format(date, "yyyy-MM-dd") : "" }))}
                            formatStr="EEE, MMM d, yyyy"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
