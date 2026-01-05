"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogHeaderProps {
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * DialogHeader - Consistent header for full-screen dialogs
 * Left: Close button, Center: Title, Right: Action buttons (children)
 */
export function DialogHeader({
  title,
  onClose,
  children,
  className,
}: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0",
        className
      )}
    >
      <button
        onClick={onClose}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X className="h-5 w-5 text-gray-600" />
      </button>

      <h2 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-gray-900">
        {title}
      </h2>

      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

interface DialogButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "warning";
  className?: string;
}

/**
 * DialogButton - Consistent button styling for dialog headers and actions
 */
export function DialogButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  variant = "primary",
  className,
}: DialogButtonProps) {
  const baseStyles =
    "h-9 px-6 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

  const variantStyles = {
    primary: "bg-gray-900 hover:bg-gray-800 active:bg-gray-700 text-white",
    secondary:
      "border border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-gray-700",
    danger:
      "border border-red-300 hover:bg-red-50 active:bg-red-100 text-red-600",
    warning:
      "border border-amber-300 hover:bg-amber-50 active:bg-amber-100 text-amber-600",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

interface ModalContainerProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

/**
 * ModalContainer - Centered modal overlay with backdrop
 */
export function ModalContainer({
  children,
  onClose,
  className,
}: ModalContainerProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "bg-white rounded-lg shadow-xl w-full mx-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  className?: string;
}

/**
 * ModalHeader - Header for overlay modals (not full-screen)
 */
export function ModalHeader({ title, onClose, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border-b border-gray-200",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <button
        onClick={onClose}
        className="p-1 text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ModalFooter - Footer for overlay modals with action buttons
 */
export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
