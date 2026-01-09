"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  notes: string | null;
  paymentMethods: PaymentMethod[];
}

export type VerificationStatus =
  | "idle"
  | "sending"
  | "awaiting_code"
  | "verifying"
  | "verified"
  | "error"
  | "rate_limited";

export interface UsePhoneVerificationReturn {
  status: VerificationStatus;
  error: string | null;
  errorCode: string | null;
  clientData: ClientData | null;
  sendCode: (phone: string) => Promise<boolean>;
  verifyCode: (phone: string, code: string) => Promise<boolean>;
  reset: () => void;
  canResend: boolean;
  resendCountdown: number;
  attemptsRemaining: number | null;
}

// Exponential backoff: 30s → 60s → 120s → 180s (capped)
const BACKOFF_DELAYS = [30, 60, 120, 180];

export function usePhoneVerification(): UsePhoneVerificationReturn {
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [sendAttempts, setSendAttempts] = useState(0);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Start countdown timer with exponential backoff
  const startCountdown = useCallback((attempt: number) => {
    // Get delay based on attempt number (0-indexed), cap at max delay
    const delayIndex = Math.min(attempt, BACKOFF_DELAYS.length - 1);
    const delay = BACKOFF_DELAYS[delayIndex];
    setResendCountdown(delay);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(
    async (phone: string): Promise<boolean> => {
      setStatus("sending");
      setError(null);
      setErrorCode(null);

      try {
        const response = await fetch("/api/verify/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            setStatus("rate_limited");
            setError(data.error || "Too many attempts. Please try again later.");
            setErrorCode("RATE_LIMITED");

            // Calculate countdown from nextAttemptAt if provided
            if (data.nextAttemptAt) {
              const nextAttempt = new Date(data.nextAttemptAt);
              const now = new Date();
              const secondsUntil = Math.max(
                0,
                Math.ceil((nextAttempt.getTime() - now.getTime()) / 1000)
              );
              // Cap at 1 hour max to prevent UI issues from time sync problems
              setResendCountdown(Math.min(secondsUntil, 3600));
            } else {
              // Default to 60 seconds if no specific time provided
              setResendCountdown(60);
            }

            return false;
          }

          setStatus("error");
          setError(data.error || "Failed to send verification code");
          setErrorCode(data.code || "UNKNOWN_ERROR");
          return false;
        }

        // Update remaining attempts
        if (typeof data.remainingAttempts === "number") {
          setAttemptsRemaining(data.remainingAttempts);
        }

        // Track send attempts for exponential backoff
        setSendAttempts((prev) => prev + 1);

        setStatus("awaiting_code");
        startCountdown(sendAttempts);
        return true;
      } catch (err) {
        setStatus("error");
        setError("Connection error. Please check your internet and try again.");
        setErrorCode("NETWORK_ERROR");
        return false;
      }
    },
    [startCountdown, sendAttempts]
  );

  const verifyCode = useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setStatus("verifying");
      setError(null);
      setErrorCode(null);

      try {
        const response = await fetch("/api/verify/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            setStatus("rate_limited");
            setError(data.error || "Too many failed attempts.");
            setErrorCode("TOO_MANY_ATTEMPTS");
            return false;
          }

          setStatus("awaiting_code");
          setError(data.error || "Invalid verification code");
          setErrorCode(data.code || "INVALID_CODE");

          // Update attempts remaining if provided
          if (typeof data.attemptsRemaining === "number") {
            setAttemptsRemaining(data.attemptsRemaining);
          }

          return false;
        }

        // Success - store client data if returned
        setStatus("verified");
        setClientData(data.client || null);
        setError(null);
        setErrorCode(null);

        // Clear countdown
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        setResendCountdown(0);

        return true;
      } catch (err) {
        setStatus("error");
        setError("Connection error. Please check your internet and try again.");
        setErrorCode("NETWORK_ERROR");
        return false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setErrorCode(null);
    setClientData(null);
    setResendCountdown(0);
    setAttemptsRemaining(null);
    setSendAttempts(0);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
  }, []);

  return {
    status,
    error,
    errorCode,
    clientData,
    sendCode,
    verifyCode,
    reset,
    canResend: resendCountdown === 0 && status !== "sending" && status !== "verifying",
    resendCountdown,
    attemptsRemaining,
  };
}
