"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
// Handles country codes like +1, 1, etc. - strips them and keeps last 10 digits
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");

  // If starts with 1 and has more than 10 digits, it's likely a country code
  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  // Take only the last 10 digits (handles any country code)
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

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
          "rounded-2xl overflow-hidden",
          "bg-white",
          "flex flex-col p-3",
          className
        )}
        style={{
          minHeight: "176px",
          boxShadow: `
            0 1px 2px rgba(0, 0, 0, 0.04),
            0 4px 8px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(16, 185, 129, 0.15)
          `,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">
              Hi, {verifiedClient.firstName}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-[10px] text-slate-400 hover:text-slate-600"
          >
            Switch
          </button>
        </div>

        {/* Quick rebook */}
        <div className="flex-1 flex flex-col justify-center">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Rebook</p>
              {appointments.slice(0, 2).map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => handleRebook(apt)}
                  className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                >
                  <p className="text-[11px] font-medium text-slate-700 truncate">
                    {apt.serviceName}
                  </p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 text-center">
              Select a location below
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render initial phone input state - Clean minimal design
  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden",
        "bg-white",
        "flex flex-col justify-between p-3",
        className
      )}
      style={{
        minHeight: "176px",
        boxShadow: `
          0 1px 2px rgba(0, 0, 0, 0.04),
          0 4px 8px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(0, 0, 0, 0.04)
        `,
      }}
    >
      {/* Shimmer keyframes for webkit/safari compliance */}
      <style jsx>{`
        @-webkit-keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .phone-input-shimmer {
          background: linear-gradient(
            135deg,
            #f8fafc 0%,
            #f1f5f9 25%,
            #fdf2f2 50%,
            #f1f5f9 75%,
            #f8fafc 100%
          );
          background-size: 200% 100%;
          -webkit-animation: shimmer 5s ease-in-out infinite;
          animation: shimmer 5s ease-in-out infinite;
        }
        .phone-input-shimmer:focus {
          -webkit-animation: none;
          animation: none;
          background: white;
        }
      `}</style>

      {/* Header - centered */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[18px] font-semibold text-slate-800">Quick Login</p>
      </div>

      {/* Phone input - compact */}
      <div className="space-y-2">
        <div className="relative">
          <label htmlFor="phone" className="sr-only">Phone Number</label>
          <input
            type="tel"
            inputMode="tel"
            name="phone"
            id="phone"
            autoComplete="tel"
            placeholder="(555) 555-5555"
            value={phone}
            onChange={handlePhoneChange}
            disabled={isSending}
            className={cn(
              "w-full h-11 px-4 rounded-xl text-center",
              "border border-slate-200/60",
              "text-[15px] font-medium text-slate-700",
              "placeholder:text-[14px] placeholder:text-slate-400/80 placeholder:font-normal placeholder:tracking-wide",
              "focus:outline-none focus:bg-white focus:border-[#8B687A]/50 focus:ring-2 focus:ring-[#8B687A]/15",
              "transition-all duration-200",
              "disabled:opacity-50",
              !phone && !isSending && "phone-input-shimmer"
            )}
          />
        </div>

        <button
          onClick={handleSendCode}
          disabled={!isPhoneValid || isSending}
          className={cn(
            "w-full h-11 rounded-xl",
            "text-[14px] font-medium",
            "flex items-center justify-center gap-1.5",
            "transition-all duration-150",
            "disabled:cursor-not-allowed",
            isPhoneValid && !isSending
              ? "bg-[#8B687A] text-white active:scale-[0.98]"
              : "bg-slate-100 text-slate-400"
          )}
        >
          {isSending ? (
            <Loader2 className="w-[17px] h-[17px] animate-spin" />
          ) : (
            <>
              <span>Send Code</span>
              <ArrowRight className="w-[17px] h-[17px]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
