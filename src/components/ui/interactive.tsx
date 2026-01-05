"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionLinkProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * ActionLink - A text button/link with consistent hover states
 */
export function ActionLink({
  onClick,
  children,
  variant = "default",
  disabled = false,
  loading = false,
  className,
}: ActionLinkProps) {
  const variantStyles = {
    default: "text-gray-700 hover:text-gray-900 hover:bg-gray-100",
    primary: "text-blue-600 hover:text-blue-700 hover:bg-blue-50",
    danger: "text-red-600 hover:text-red-700 hover:bg-red-50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "text-sm px-2 py-1 -mx-2 rounded transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        variantStyles[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

interface UnderlineLinkProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * UnderlineLink - An underlined text link (like "Add discount")
 */
export function UnderlineLink({
  onClick,
  children,
  disabled = false,
  className,
}: UnderlineLinkProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-sm text-gray-900 underline hover:no-underline hover:text-gray-700 font-medium transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}

interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  variant?: "default" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * IconButton - A button with just an icon
 */
export function IconButton({
  onClick,
  icon,
  label,
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  className,
}: IconButtonProps) {
  const sizeStyles = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-10 h-10",
  };

  const variantStyles = {
    default:
      "border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700",
    ghost:
      "text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200",
    danger:
      "text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        icon
      )}
    </button>
  );
}

interface SelectableItemProps {
  onClick: () => void;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * SelectableItem - A clickable list item (for search results, service picker, etc.)
 */
export function SelectableItem({
  onClick,
  title,
  subtitle,
  rightContent,
  selected = false,
  disabled = false,
  className,
}: SelectableItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "bg-gray-900 text-white"
          : "hover:bg-gray-50 active:bg-gray-100",
        className
      )}
    >
      <div>
        <p
          className={cn(
            "text-sm font-medium",
            selected ? "text-white" : "text-gray-900"
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className={cn(
              "text-xs mt-0.5",
              selected ? "text-gray-300" : "text-gray-500"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightContent && (
        <span
          className={cn(
            "text-sm font-medium",
            selected ? "text-white" : "text-gray-900"
          )}
        >
          {rightContent}
        </span>
      )}
    </button>
  );
}

interface ToggleButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * ToggleButton - A button that can be selected/unselected (for discount type, frequency, etc.)
 */
export function ToggleButton({
  selected,
  onClick,
  children,
  disabled = false,
  className,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-gray-50",
        className
      )}
    >
      {children}
    </button>
  );
}

interface CheckboxRowProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  helpText?: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * CheckboxRow - A clickable row with checkbox, label, and optional help icon
 */
export function CheckboxRow({
  checked,
  onCheckedChange,
  label,
  helpText,
  icon,
  className,
}: CheckboxRowProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 cursor-pointer group",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
        {label}
      </span>
      {icon && (
        <span className="text-gray-400 group-hover:text-gray-600 transition-colors cursor-help">
          {icon}
        </span>
      )}
      {helpText && (
        <span className="text-xs text-gray-500">{helpText}</span>
      )}
    </label>
  );
}
