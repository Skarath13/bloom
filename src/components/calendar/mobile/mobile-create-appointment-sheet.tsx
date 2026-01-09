"use client";

import { useState, useEffect } from "react";
import { format, addMinutes } from "date-fns";
import {
  X,
  ChevronLeft,
  Clock,
  User,
  MapPin,
  Calendar,
  Loader2,
  Check,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MobileClientSearch } from "./mobile-client-search";
import { MobileServicePicker } from "./mobile-service-picker";
import { useMobileNav } from "@/contexts/mobile-nav-context";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

interface MobileCreateAppointmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianId: string;
  technicianName: string;
  technicianColor: string;
  locationId: string;
  locationName: string;
  time: Date;
  onSuccess: () => void;
  preloadedClient?: Client | null;
}

type Step = 1 | 2 | 3;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function MobileCreateAppointmentSheet({
  open,
  onOpenChange,
  technicianId,
  technicianName,
  technicianColor,
  locationId,
  locationName,
  time,
  onSuccess,
  preloadedClient,
}: MobileCreateAppointmentSheetProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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

  // Initialize state when sheet opens - handles both fresh open and preloaded client
  useEffect(() => {
    if (open) {
      setSelectedServices([]);
      setNotes("");

      // If we have a preloaded client, use it and skip to step 2
      if (preloadedClient) {
        setSelectedClient(preloadedClient);
        setStep(2);
      } else {
        setSelectedClient(null);
        setStep(1);
      }
    }
  }, [open, preloadedClient]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      handleClose();
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedClient) {
      toast.error("Please select a client");
      return;
    }
    if (step === 2 && selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    if (step < 3) {
      setStep((step + 1) as Step);
    }
  };

  const handleCreate = async () => {
    if (!selectedClient || selectedServices.length === 0) return;

    setIsCreating(true);
    try {
      // Calculate total duration
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
      const endTime = addMinutes(time, totalDuration);

      // Create the appointment
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          technicianId,
          locationId,
          startTime: time.toISOString(),
          endTime: endTime.toISOString(),
          status: "CONFIRMED",
          notes: notes.trim() || undefined,
          // Line items for each service
          lineItems: selectedServices.map((service) => ({
            itemType: "service",
            serviceId: service.id,
            name: service.name,
            quantity: 1,
            unitPrice: service.price,
            discountAmount: 0,
            totalAmount: service.price,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create appointment");
      }

      toast.success("Appointment created");
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create appointment");
    } finally {
      setIsCreating(false);
    }
  };

  // Calculate totals
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const endTime = addMinutes(time, totalDuration || 60);

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Select Client";
      case 2:
        return "Select Services";
      case 3:
        return "Confirm";
      default:
        return "New Appointment";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden !h-[100dvh] overflow-hidden"
      >
        <SheetTitle className="sr-only">Create Appointment</SheetTitle>
        <SheetDescription className="sr-only">
          Create a new appointment in {step === 1 ? "3" : step === 2 ? "2" : "1"} steps
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            {step === 1 ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <ChevronLeft className="h-6 w-6 text-gray-600" />
            )}
          </button>
          <h1 className="text-lg font-semibold">{getStepTitle()}</h1>
          {step > 1 ? (
            <button
              onClick={handleClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          ) : (
            <div className="min-w-[44px]" />
          )}
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 justify-center py-3 bg-white border-b border-gray-100 flex-shrink-0">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                s === step ? "bg-blue-600" : s < step ? "bg-blue-300" : "bg-gray-300"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 mobile-sheet-scroll"
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Step 1: Client Selection */}
          {step === 1 && (
            <MobileClientSearch
              selectedClient={selectedClient}
              onClientSelect={setSelectedClient}
            />
          )}

          {/* Step 2: Service Selection */}
          {step === 2 && (
            <MobileServicePicker
              locationId={locationId}
              selectedServices={selectedServices}
              onServicesChange={setSelectedServices}
            />
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-white rounded-xl p-4 space-y-4">
                {/* Client */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {selectedClient?.firstName} {selectedClient?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{selectedClient?.phone}</div>
                  </div>
                </div>

                <hr />

                {/* Time & Location */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{format(time, "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>
                      {format(time, "h:mm a")} - {format(endTime, "h:mm a")}{" "}
                      <span className="text-gray-500">({formatDuration(totalDuration)})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: technicianColor }}
                    />
                    <span>{technicianName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{locationName}</span>
                  </div>
                </div>

                <hr />

                {/* Services */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-500">Services</div>
                  {selectedServices.map((service) => (
                    <div key={service.id} className="flex justify-between text-sm">
                      <span>{service.name}</span>
                      <span>${service.price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>${totalPrice}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl p-4">
                <label className="text-sm font-medium text-gray-500 block mb-2">
                  Notes (optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for this appointment..."
                  rows={3}
                />
              </div>

              {/* Deposit Info */}
              {selectedServices.some((s) => s.depositAmount > 0) && (
                <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
                  <strong>Note:</strong> This appointment may require a deposit for no-show protection.
                </div>
              )}
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-24" />
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 p-4 bg-white border-t border-gray-200"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {step < 3 ? (
            <Button
              onClick={handleNext}
              className="w-full h-12"
              disabled={
                (step === 1 && !selectedClient) ||
                (step === 2 && selectedServices.length === 0)
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              className="w-full h-12 bg-green-600 hover:bg-green-700"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
