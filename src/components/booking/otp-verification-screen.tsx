"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Loader2, ArrowLeft, User, CalendarDays, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OTPInput } from "@/components/ui/otp-input";
import {
  usePhoneVerification,
  ClientData,
} from "@/hooks/use-phone-verification";
import { useBooking } from "./booking-context";

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

interface OtpVerificationScreenProps {
  phone: string;
  formattedPhone: string;
  onBack: () => void;
  onVerified: (clientData: ClientData | null) => void;
}

export function OtpVerificationScreen({
  phone,
  formattedPhone,
  onBack,
  onVerified,
}: OtpVerificationScreenProps) {
  const router = useRouter();
  const { resetBooking, setLocation, setService, setTechnician } = useBooking();
  const {
    status,
    error,
    clientData,
    sendCode,
    verifyCode,
    reset,
    canResend,
    resendCountdown,
  } = usePhoneVerification();

  const [otpValue, setOtpValue] = useState("");
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Use ref to prevent double-send in React Strict Mode
  const codeSentRef = useRef(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Send code on mount (only once)
  useEffect(() => {
    if (!codeSentRef.current) {
      codeSentRef.current = true;
      sendCode(phone);
    }
  }, [phone, sendCode]);

  // Fetch appointment history when verified
  useEffect(() => {
    if (status === "verified" && clientData?.id) {
      fetchAppointmentHistory(clientData.id);
      onVerified(clientData);
    }
  }, [status, clientData, onVerified]);

  const fetchAppointmentHistory = async (clientId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/appointments?limit=5`);
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

  const handleOtpChange = (value: string) => {
    setOtpValue(value);
  };

  const handleOtpComplete = async (code: string) => {
    await verifyCode(phone, code);
  };

  const handleResendCode = async () => {
    setOtpValue("");
    await sendCode(phone);
  };

  const handleBack = () => {
    reset();
    onBack();
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
        0
      );
      setTechnician(
        appointment.technicianId,
        appointment.technicianName,
        false
      );
      router.push(
        `/book/${appointment.locationSlug}/${appointment.serviceId}/${appointment.technicianId}`
      );
    },
    [resetBooking, setLocation, setService, setTechnician, router]
  );

  // Verified state - show welcome + history
  if (status === "verified" && clientData) {
    return (
      <div className="min-h-screen-mobile flex flex-col bg-white safe-area-inset-top safe-area-inset-bottom">
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <button
            onClick={handleBack}
            className="flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to locations
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center px-6 pt-8">
          {/* Welcome */}
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">
            Welcome back, {clientData.firstName}!
          </h1>
          <p className="text-sm text-slate-500 mb-2">
            {formattedPhone}
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-sm text-[#8B687A] hover:underline mb-6"
          >
            <Pencil className="w-3 h-3" />
            Edit Profile
          </Link>

          {/* Appointment history */}
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : appointments.length > 0 ? (
            <div className="w-full max-w-sm space-y-3">
              <p className="text-sm font-medium text-slate-700">Rebook a past appointment:</p>
              {appointments.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => handleRebook(apt)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {apt.serviceName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {apt.locationName} &middot; {apt.technicianName}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center text-[#8B687A]">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Rebook</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500">No past appointments</p>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="flex-shrink-0 px-6 py-4">
          <Button
            onClick={handleBack}
            variant="outline"
            className="w-full h-12"
          >
            Browse all locations
          </Button>
        </div>
      </div>
    );
  }

  // OTP entry state
  return (
    <div className="min-h-screen-mobile flex flex-col bg-white safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <button
          onClick={handleBack}
          className="flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Change number
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Phone icon */}
        <div className="w-16 h-16 rounded-full bg-[#8B687A]/10 flex items-center justify-center mb-6">
          <Phone className="w-8 h-8 text-[#8B687A]" />
        </div>

        {/* Instructions */}
        <h1 className="text-lg font-semibold text-slate-900 mb-1 text-center">
          Enter the code sent to
        </h1>
        <p className="text-base text-slate-600 mb-8">
          {formattedPhone}
        </p>

        {/* OTP Input */}
        <div className="w-full max-w-xs">
          <OTPInput
            value={otpValue}
            onChange={handleOtpChange}
            onComplete={handleOtpComplete}
            disabled={status === "verifying" || status === "sending"}
            error={!!error}
            autoFocus
          />

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 text-center mt-4">{error}</p>
          )}

          {/* Loading indicator */}
          {(status === "verifying" || status === "sending") && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B687A]" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-6">
        <div className="flex items-center justify-center gap-6 text-sm">
          <button
            onClick={handleBack}
            className="text-slate-400 hover:text-slate-600"
          >
            Change number
          </button>
          {canResend ? (
            <button
              onClick={handleResendCode}
              className="text-[#8B687A] font-medium hover:underline"
            >
              Resend code
            </button>
          ) : (
            <span className="text-slate-400">
              Resend in {resendCountdown}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
