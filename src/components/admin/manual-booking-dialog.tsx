"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CardPaymentForm } from "@/components/booking/card-payment-form";
import { getStripe } from "@/lib/stripe-client";
import { toast } from "sonner";
import {
  Search,
  User,
  Phone,
  CreditCard,
  Plus,
  Check,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

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
}

interface ManualBookingDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  technicianName: string;
  locationId: string;
  time: Date;
  onSuccess: () => void;
}

type Step = "search" | "new-client" | "select-service" | "select-card" | "add-card" | "confirm";

export function ManualBookingDialog({
  open,
  onClose,
  technicianId,
  technicianName,
  locationId,
  time,
  onSuccess,
}: ManualBookingDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected client
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // New client form
  const [newClientForm, setNewClientForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Card
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [noShowProtection, setNoShowProtection] = useState(true);

  // Notes
  const [notes, setNotes] = useState("");

  // Processing
  const [processing, setProcessing] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep("search");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedClient(null);
      setNewClientForm({ firstName: "", lastName: "", phone: "", email: "" });
      setSelectedServiceId("");
      setSelectedPaymentMethodId("");
      setClientSecret("");
      setNotes("");
      setNoShowProtection(true);
      fetchServices();
    }
  }, [open, locationId]);

  const fetchServices = async () => {
    try {
      const response = await fetch(`/api/services?locationId=${locationId}`);
      const data = await response.json();
      if (data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.clients || []);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search clients");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setStep("select-service");

    // Pre-select default payment method if exists
    if (client.paymentMethods?.length) {
      const defaultPm = client.paymentMethods.find(pm => pm.isDefault) || client.paymentMethods[0];
      setSelectedPaymentMethodId(defaultPm.id);
    }
  };

  const handleCreateNewClient = async () => {
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
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
      setStep("select-service");
    } catch (error) {
      console.error("Create client error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelected = () => {
    if (!selectedServiceId) {
      toast.error("Please select a service");
      return;
    }

    if (selectedClient?.paymentMethods?.length) {
      setStep("select-card");
    } else if (noShowProtection) {
      setStep("add-card");
      createSetupIntent();
    } else {
      setStep("confirm");
    }
  };

  const createSetupIntent = async () => {
    if (!selectedClient) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${selectedClient.id}/setup-intent`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create setup intent");
      }

      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error("Setup intent error:", error);
      toast.error("Failed to initialize card form");
    } finally {
      setLoading(false);
    }
  };

  const handleCardSelectionComplete = () => {
    setStep("confirm");
  };

  const handleAddNewCard = () => {
    setStep("add-card");
    createSetupIntent();
  };

  const handleCardSaved = async (paymentMethodId: string) => {
    // Save the payment method to the client
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/clients/${selectedClient.id}/payment-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId,
          setAsDefault: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save payment method");
      }

      setSelectedPaymentMethodId(paymentMethodId);
      setStep("confirm");
    } catch (error) {
      console.error("Save payment method error:", error);
      toast.error("Failed to save card");
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedClient || !selectedServiceId) {
      toast.error("Missing required information");
      return;
    }

    const service = services.find(s => s.id === selectedServiceId);
    if (!service) {
      toast.error("Invalid service selected");
      return;
    }

    setProcessing(true);
    try {
      const endTime = new Date(time.getTime() + service.durationMinutes * 60000);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          technicianId,
          locationId,
          serviceId: selectedServiceId,
          startTime: time.toISOString(),
          endTime: endTime.toISOString(),
          status: "CONFIRMED",
          notes: notes || undefined,
          noShowProtected: noShowProtection && (!!selectedPaymentMethodId || selectedClient.paymentMethods?.length),
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
      setProcessing(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 10) value = value.slice(0, 10);

    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }

    setNewClientForm(prev => ({ ...prev, phone: value }));
  };

  const selectedService = services.find(s => s.id === selectedServiceId);

  const renderStep = () => {
    switch (step) {
      case "search":
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {searchResults.map((client) => (
                  <button
                    key={client.id}
                    className="w-full p-3 text-left hover:bg-muted flex items-center justify-between"
                    onClick={() => handleSelectClient(client)}
                  >
                    <div>
                      <div className="font-medium">{client.firstName} {client.lastName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {client.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                      </div>
                    </div>
                    {client.paymentMethods?.length ? (
                      <Badge variant="outline" className="text-xs">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Card on file
                      </Badge>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No clients found
              </p>
            )}

            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("new-client")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Client
              </Button>
            </div>
          </div>
        );

      case "new-client":
        return (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to search
            </Button>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={newClientForm.firstName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={newClientForm.lastName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={newClientForm.phone}
                onChange={handlePhoneChange}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>

            <Button onClick={handleCreateNewClient} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Client & Continue
            </Button>
          </div>
        );

      case "select-service":
        return (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change client
            </Button>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedClient?.firstName} {selectedClient?.lastName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Service</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{service.name}</span>
                        <span className="text-muted-foreground">
                          {service.durationMinutes}min - ${Number(service.price).toFixed(2)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={2}
              />
            </div>

            <Button onClick={handleServiceSelected} disabled={!selectedServiceId} className="w-full">
              Continue
            </Button>
          </div>
        );

      case "select-card":
        return (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("select-service")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="space-y-2">
              <Label>Select Card for No-Show Protection</Label>
              <div className="space-y-2">
                {selectedClient?.paymentMethods?.map((pm) => (
                  <button
                    key={pm.id}
                    className={`w-full p-3 border rounded-lg text-left flex items-center justify-between ${
                      selectedPaymentMethodId === pm.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethodId(pm.id)}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span className="capitalize">{pm.brand}</span>
                      <span>•••• {pm.last4}</span>
                      {pm.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                    </div>
                    {selectedPaymentMethodId === pm.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={handleAddNewCard} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add New Card
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setNoShowProtection(false);
                setStep("confirm");
              }}
              className="w-full text-muted-foreground"
            >
              Skip (No protection)
            </Button>

            <Button onClick={handleCardSelectionComplete} disabled={!selectedPaymentMethodId} className="w-full">
              Continue with Selected Card
            </Button>
          </div>
        );

      case "add-card":
        return (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep(selectedClient?.paymentMethods?.length ? "select-card" : "select-service")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : clientSecret ? (
              <Elements
                stripe={getStripe()}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#1E1B4B",
                      borderRadius: "8px",
                    },
                  },
                }}
              >
                <CardPaymentForm
                  onSuccess={handleCardSaved}
                  onError={(error) => toast.error(error)}
                  isProcessing={processing}
                  setIsProcessing={setProcessing}
                />
              </Elements>
            ) : null}
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("select-service")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="border rounded-lg divide-y">
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{selectedClient?.firstName} {selectedClient?.lastName}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{selectedService?.durationMinutes} minutes</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>{format(time, "h:mm a")}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-muted-foreground">Technician</span>
                <span>{technicianName}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-muted-foreground">No-Show Protection</span>
                {noShowProtection && selectedPaymentMethodId ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <ShieldCheck className="h-4 w-4" />
                    Enabled
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>

            <Button onClick={handleConfirmBooking} disabled={processing} className="w-full">
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Appointment
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            {technicianName} at {format(time, "h:mm a")}
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
