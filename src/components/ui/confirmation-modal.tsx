"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalContainer, ModalFooter } from "./dialog-header";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant: "danger" | "warning" | "primary";
  icon?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
}

const variantStyles = {
  danger: {
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    buttonBg: "bg-red-600 hover:bg-red-700 active:bg-red-800",
  },
  warning: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    buttonBg: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
  },
  primary: {
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    buttonBg: "bg-gray-900 hover:bg-gray-800 active:bg-gray-700",
  },
};

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant,
  icon,
  loading = false,
  children,
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const styles = variantStyles[variant];

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  const isProcessing = loading || isLoading;

  if (!open) return null;

  return (
    <ModalContainer onClose={isProcessing ? undefined : onClose} className="max-w-md">
      <div className="p-6">
        {/* Header with icon and title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              styles.iconBg
            )}
          >
            {icon || <AlertTriangle className={cn("h-5 w-5", styles.iconColor)} />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Description */}
        <div className="text-gray-600 mb-4">{description}</div>

        {/* Optional children (additional content) */}
        {children}
      </div>

      {/* Footer with buttons */}
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer border border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className={cn(
            "h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] flex items-center justify-center",
            styles.buttonBg
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            confirmLabel
          )}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}

/**
 * A simpler info modal with just an "Understood" button
 * Used for showing blocking information (e.g., "Cannot delete location")
 */
interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  buttonLabel?: string;
  variant?: "danger" | "warning" | "primary";
  icon?: React.ReactNode;
}

export function InfoModal({
  open,
  onClose,
  title,
  description,
  buttonLabel = "Understood",
  variant = "warning",
  icon,
}: InfoModalProps) {
  const styles = variantStyles[variant];

  if (!open) return null;

  return (
    <ModalContainer onClose={onClose} className="max-w-md">
      <div className="p-6">
        {/* Header with icon and title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              styles.iconBg
            )}
          >
            {icon || <AlertTriangle className={cn("h-5 w-5", styles.iconColor)} />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Description */}
        <div className="text-gray-600">{description}</div>
      </div>

      {/* Footer with single button */}
      <ModalFooter>
        <button
          onClick={onClose}
          className="h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white"
        >
          {buttonLabel}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
