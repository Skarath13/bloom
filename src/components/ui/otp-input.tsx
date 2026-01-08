"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
  className?: string;
}

function OTPInput({
  value,
  onChange,
  disabled = false,
  error = false,
  autoFocus = false,
  onComplete,
  className,
}: OTPInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = React.useState(false);

  // Trigger shake animation on error
  React.useEffect(() => {
    if (error) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Focus first input on mount if autoFocus
  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Convert value to array of digits
  const digits = value.split("").slice(0, 6);
  while (digits.length < 6) {
    digits.push("");
  }

  const handleChange = (index: number, newValue: string) => {
    // Only allow digits
    const digit = newValue.replace(/\D/g, "").slice(-1);

    // Update the value
    const newDigits = [...digits];
    newDigits[index] = digit;
    const newCode = newDigits.join("");
    onChange(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete when all 6 digits are entered
    if (newCode.length === 6 && onComplete) {
      onComplete(newCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        // Clear current input
        const newDigits = [...digits];
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        // Move to previous input and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (pastedData) {
      onChange(pastedData);
      // Focus the appropriate input after paste
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();

      // Call onComplete if 6 digits were pasted
      if (pastedData.length === 6 && onComplete) {
        onComplete(pastedData);
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div
      className={cn(
        "flex gap-2 justify-center",
        shake && "animate-shake",
        className
      )}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of 6`}
          className={cn(
            "w-11 h-14 text-center text-xl font-semibold rounded-lg border bg-background",
            "transition-all duration-150 outline-none",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            error
              ? "border-destructive ring-2 ring-destructive/20"
              : "border-input",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}

export { OTPInput };
export type { OTPInputProps };
