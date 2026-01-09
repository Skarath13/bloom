"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2, ArrowLeft } from "lucide-react";
import { OTPInput } from "@/components/ui/otp-input";
import {
  usePhoneVerification,
  ClientData,
} from "@/hooks/use-phone-verification";

interface OtpVerificationScreenProps {
  phone: string;
  formattedPhone: string;
  onBack: () => void;
  onVerified: (clientData: ClientData | null, phone: string, sessionToken: string | null) => void;
}

export function OtpVerificationScreen({
  phone,
  formattedPhone,
  onBack,
  onVerified,
}: OtpVerificationScreenProps) {
  const router = useRouter();
  const {
    status,
    error,
    clientData,
    sessionToken,
    sendCode,
    verifyCode,
    reset,
    canResend,
    resendCountdown,
  } = usePhoneVerification();

  const [otpValue, setOtpValue] = useState("");

  // Use ref to prevent double-send in React Strict Mode
  const codeSentRef = useRef(false);

  // Disable Safari scroll restoration and scroll to top on mount
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, []);

  // Send code on mount (only once)
  useEffect(() => {
    if (!codeSentRef.current) {
      codeSentRef.current = true;
      sendCode(phone);
    }
  }, [phone, sendCode]);

  // When verified, save session and redirect to /profile
  useEffect(() => {
    if (status === "verified" && clientData?.id) {
      onVerified(clientData, phone, sessionToken);
      router.push("/profile");
    }
  }, [status, clientData, onVerified, phone, sessionToken, router]);

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
