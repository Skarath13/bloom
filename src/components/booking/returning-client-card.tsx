"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBooking } from "./booking-context";
import { cn } from "@/lib/utils";

interface AppointmentHistoryItem {
  id: string;
  serviceName: string;
  technicianName: string;
  technicianColor: string;
  locationName: string;
  locationSlug: string;
  locationId: string;
  serviceId: string;
  serviceDuration: number;
  servicePrice: number;
  technicianId: string;
  startTime: string;
  status: string;
}

interface ReturningClientCardProps {
  className?: string;
  onSendCode?: (phone: string, formattedPhone: string) => void;
  verifiedClient?: {
    firstName: string;
    id: string;
  } | null;
}

// Format phone number as user types: (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Get raw digits from formatted phone
function getDigits(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

export function ReturningClientCard({
  className,
  onSendCode,
  verifiedClient,
}: ReturningClientCardProps) {
  const router = useRouter();
  const { resetBooking, setLocation, setService, setTechnician } = useBooking();

  const [phone, setPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch appointment history when we have a verified client
  useEffect(() => {
    if (verifiedClient?.id) {
      fetchAppointmentHistory(verifiedClient.id);
    }
  }, [verifiedClient?.id]);

  const fetchAppointmentHistory = async (clientId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/appointments?limit=3`);
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error("Failed to fetch appointment history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSendCode = async () => {
    const digits = getDigits(phone);
    if (digits.length === 10 && onSendCode) {
      setIsSending(true);
      onSendCode(digits, phone);
      // Don't reset isSending - parent will unmount this component
    }
  };

  const handleRebook = useCallback(
    (appointment: AppointmentHistoryItem) => {
      resetBooking();
      setLocation(
        appointment.locationId,
        appointment.locationName,
        appointment.locationSlug
      );
      setService(
        appointment.serviceId,
        appointment.serviceName,
        appointment.servicePrice,
        appointment.serviceDuration,
        0 // deposit - will be recalculated
      );
      setTechnician(
        appointment.technicianId,
        appointment.technicianName,
        false
      );

      // Navigate to date/time selection
      router.push(
        `/book/${appointment.locationSlug}/${appointment.serviceId}/${appointment.technicianId}`
      );
    },
    [resetBooking, setLocation, setService, setTechnician, router]
  );

  const handleReset = () => {
    setPhone("");
    setAppointments([]);
  };

  const isPhoneValid = getDigits(phone).length === 10;

  // Render verified state with appointment history
  if (verifiedClient) {
    return (
      <div
        className={cn(
          "rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm p-4",
          className
        )}
      >
        {/* Welcome message */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <User className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Welcome back, {verifiedClient.firstName}!
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Switch
          </button>
        </div>

        {/* Appointment history or empty state */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-2">Recent appointments:</p>
            {appointments.slice(0, 2).map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    {apt.serviceName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {apt.locationName} - {apt.technicianName}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRebook(apt)}
                  className="ml-2 h-7 text-xs px-2 shrink-0"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Rebook
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-2">
            <CalendarDays className="w-6 h-6 mx-auto text-slate-300 mb-1" />
            <p className="text-xs text-slate-500">
              Select a location below to book
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render initial phone input state
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#8B687A]/10 flex items-center justify-center">
          <User className="w-4 h-4 text-[#8B687A]" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">Returning?</p>
          <p className="text-[10px] text-slate-500">Log in to rebook</p>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          type="tel"
          placeholder="(555) 555-5555"
          value={phone}
          onChange={handlePhoneChange}
          disabled={isSending}
          className="h-10 text-sm"
        />

        <Button
          onClick={handleSendCode}
          disabled={!isPhoneValid || isSending}
          className="w-full h-10 text-sm bg-[#8B687A] hover:bg-[#6d5261]"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Code"
          )}
        </Button>
      </div>
    </div>
  );
}
