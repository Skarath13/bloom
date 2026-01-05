"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
  noBorder?: boolean;
  /** Use narrow mode for personal event forms */
  narrow?: boolean;
}

/**
 * FormRow - A reusable form row component with label/value layout
 * Used across dialogs for consistent styling
 */
export function FormRow({
  label,
  children,
  className,
  labelClassName,
  contentClassName,
  noBorder = false,
  narrow = false,
}: FormRowProps) {
  return (
    <div
      className={cn(
        "grid group transition-colors",
        narrow ? "grid-cols-[140px_1fr]" : "grid-cols-[200px_1fr]",
        !noBorder && "border-b border-gray-300 last:border-b-0",
        className
      )}
    >
      <div
        className={cn(
          "px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 transition-colors group-hover:bg-gray-100",
          labelClassName
        )}
      >
        {label}
      </div>
      <div className={cn("px-4 py-3", contentClassName)}>{children}</div>
    </div>
  );
}

interface FormRowInputProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}

/**
 * FormRowInput - A form row variant with no padding for input elements
 */
export function FormRowInput({
  label,
  children,
  className,
  noBorder = false,
}: FormRowInputProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[200px_1fr] group transition-colors",
        !noBorder && "border-b border-gray-300 last:border-b-0",
        className
      )}
    >
      <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 transition-colors group-hover:bg-gray-100">
        {label}
      </div>
      <div className="px-2 py-1">{children}</div>
    </div>
  );
}

interface FormRowSplitProps {
  leftLabel: string;
  leftContent: React.ReactNode;
  rightLabel: string;
  rightContent: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}

/**
 * FormRowSplit - A form row with two label/value pairs side by side
 */
export function FormRowSplit({
  leftLabel,
  leftContent,
  rightLabel,
  rightContent,
  className,
  noBorder = false,
}: FormRowSplitProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[200px_1fr_160px_1fr] group transition-colors",
        !noBorder && "border-b border-gray-300 last:border-b-0",
        className
      )}
    >
      <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 transition-colors group-hover:bg-gray-100">
        {leftLabel}
      </div>
      <div className="px-4 py-3 text-sm text-gray-900">{leftContent}</div>
      <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 border-l border-gray-300 transition-colors group-hover:bg-gray-100">
        {rightLabel}
      </div>
      <div className="px-4 py-3 text-sm text-gray-900">{rightContent}</div>
    </div>
  );
}

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  rightContent?: React.ReactNode;
}

/**
 * FormSection - A wrapper for form rows with optional title
 */
export function FormSection({
  title,
  children,
  className,
  rightContent,
}: FormSectionProps) {
  return (
    <div className={cn("mb-6", className)}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-gray-900">{title}</h3>
          {rightContent}
        </div>
      )}
      <div className="border border-gray-300 rounded-lg overflow-hidden [&>*:first-child]:rounded-t-none [&>*:last-child]:rounded-b-none">
        {children}
      </div>
    </div>
  );
}
