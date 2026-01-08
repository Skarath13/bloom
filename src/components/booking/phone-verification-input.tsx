"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "@/components/ui/otp-input";
import { Button } from "@/components/ui/button";
import {
  usePhoneVerification,
  ClientData,
} from "@/hooks/use-phone-verification";
import { Check, Loader2, Phone, AlertCircle, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneVerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerified: (clientData: ClientData | null) => void;
  disabled?: boolean;
  className?: string;
}

// Format phone number as (XXX) XXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Get raw digits from formatted phone
function getDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function PhoneVerificationInput({
  value,
  onChange,
  onVerified,
  disabled = false,
  className,
}: PhoneVerificationInputProps) {
  const [otpValue, setOtpValue] = useState("");
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Ref to track the phone we last sent a code to (prevents double-sends in Strict Mode)
  const lastSentPhoneRef = useRef<string | null>(null);

  const {
    status,
    error,
    errorCode,
    clientData,
    sendCode,
    verifyCode,
    reset,
    canResend,
    resendCountdown,
    attemptsRemaining,
  } = usePhoneVerification();

  const phoneDigits = getDigits(value);
  const isValidPhone = phoneDigits.length === 10;
  const isVerified = status === "verified";

  // Handle manual send code button click
  const handleSendCode = useCallback(() => {
    if (isValidPhone && !disabled) {
      lastSentPhoneRef.current = phoneDigits;
      sendCode(phoneDigits);
      setShowOtpPanel(true);
    }
  }, [isValidPhone, phoneDigits, sendCode, disabled]);

  // Notify parent when verification is complete
  useEffect(() => {
    if (isVerified) {
      onVerified(clientData);
    }
  }, [isVerified, clientData, onVerified]);

  // Reset verification when phone changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = formatPhone(e.target.value);
    const newDigits = getDigits(newValue);

    // If phone changes after verification started, reset
    if (showOtpPanel && newDigits !== phoneDigits) {
      reset();
      setShowOtpPanel(false);
      setOtpValue("");
      lastSentPhoneRef.current = null; // Allow re-sending to new phone
    }

    onChange(newValue);
  };

  // Handle OTP input
  const handleOtpChange = (newOtp: string) => {
    setOtpValue(newOtp);
    setHasError(false);
  };

  // Auto-verify when 6 digits entered
  const handleOtpComplete = async (code: string) => {
    const success = await verifyCode(phoneDigits, code);
    if (!success) {
      setHasError(true);
      setOtpValue("");
    }
  };

  // Resend code
  const handleResend = async () => {
    setOtpValue("");
    setHasError(false);
    await sendCode(phoneDigits);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Phone Input */}
      <div>
        <Label htmlFor="phone" className="text-xs">
          Phone *
        </Label>
        <div className="flex gap-2 mt-1">
          <div className="relative flex-1">
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-5555"
              value={value}
              onChange={handlePhoneChange}
              disabled={disabled || isVerified}
              className={cn(
                "h-11 text-base pr-10",
                isVerified && "bg-green-50 border-green-300"
              )}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isVerified && (
                <Check className="h-5 w-5 text-green-600" />
              )}
            </div>
          </div>
          {/* Send Code Button - shown when valid phone and not yet verified */}
          {isValidPhone && !isVerified && !showOtpPanel && (
            <Button
              type="button"
              onClick={handleSendCode}
              disabled={disabled || status === "sending"}
              className="h-11 px-4"
            >
              {status === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* OTP Panel - Shown when verification is in progress */}
      {showOtpPanel && !isVerified && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <Phone className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-medium">Verify your phone number</h3>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to
              <br />
              <span className="font-medium text-foreground">{value}</span>
            </p>
          </div>

          {/* OTP Input */}
          <OTPInput
            value={otpValue}
            onChange={handleOtpChange}
            onComplete={handleOtpComplete}
            disabled={disabled || status === "verifying" || status === "rate_limited"}
            error={hasError}
            autoFocus
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <span className="text-muted-foreground">
                  ({attemptsRemaining} attempts remaining)
                </span>
              )}
            </div>
          )}

          {/* Verifying indicator */}
          {status === "verifying" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          )}

          {/* Resend Button */}
          <div className="text-center">
            {canResend ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={disabled || status === "sending"}
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend code"
                )}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Resend code in {resendCountdown}s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Welcome Back Banner - Shown for returning clients */}
      {isVerified && clientData && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-3">
          <PartyPopper className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">
              Welcome back, {clientData.firstName}!
            </p>
            <p className="text-sm text-green-700">
              Your information has been pre-filled.
            </p>
          </div>
        </div>
      )}

      {/* New Client Verified - Shown for new clients */}
      {isVerified && !clientData && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-3 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">
            Phone verified! Please complete your information below.
          </p>
        </div>
      )}
    </div>
  );
}
