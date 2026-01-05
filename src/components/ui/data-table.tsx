"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
  emptyMessage?: string;
}

/**
 * DataTable - A reusable table component for services, items, etc.
 */
export function DataTable<T>({
  columns,
  data,
  renderRow,
  onAdd,
  addLabel = "Add item",
  className,
  emptyMessage,
}: DataTableProps<T>) {
  // Build grid template from columns
  const gridTemplate = columns.map((col) => col.width || "1fr").join(" ");

  return (
    <div
      className={cn(
        "border border-gray-300 rounded-lg overflow-hidden isolate",
        className
      )}
    >
      {/* Header */}
      <div
        className="grid bg-gray-50 border-b-2 border-gray-300"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col, index) => (
          <div
            key={col.key}
            className={cn(
              "px-4 py-3 text-sm font-medium text-gray-900",
              col.align === "right" && "text-right",
              col.align === "center" && "text-center",
              index > 0 && "border-l border-gray-300"
            )}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.length > 0 ? (
        data.map((item, index) => renderRow(item, index))
      ) : emptyMessage ? (
        <div className="px-4 py-4 text-sm text-gray-500 text-center">
          {emptyMessage}
        </div>
      ) : null}

      {/* Add button */}
      {onAdd && (
        <div className="px-4 py-3">
          <button
            onClick={onAdd}
            className="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  gridTemplate: string;
  onRemove?: () => void;
  removing?: boolean;
  className?: string;
}

/**
 * TableRow - A single row in a DataTable with optional remove button
 */
export function TableRow({
  children,
  gridTemplate,
  onRemove,
  removing = false,
  className,
}: TableRowProps) {
  return (
    <div
      className={cn(
        "grid border-b border-gray-300 last:border-b-0 group hover:bg-gray-50 transition-colors",
        className
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {children}
      {onRemove && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRemove}
            disabled={removing}
            className="p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Remove"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  border?: boolean;
  className?: string;
}

/**
 * TableCell - A single cell in a TableRow
 */
export function TableCell({
  children,
  align = "left",
  border = false,
  className,
}: TableCellProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 text-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        border && "border-l border-gray-300",
        className
      )}
    >
      {children}
    </div>
  );
}

interface RemoveButtonProps {
  onClick: () => void;
  loading?: boolean;
  className?: string;
}

/**
 * RemoveButton - Consistent remove/delete button with hover reveal
 */
export function RemoveButton({
  onClick,
  loading = false,
  className,
}: RemoveButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 active:text-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      aria-label="Remove"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <X className="h-4 w-4" />
      )}
    </button>
  );
}

interface TotalsSectionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TotalsSection - Container for discount and total rows
 */
export function TotalsSection({ children, className }: TotalsSectionProps) {
  return (
    <div
      className={cn(
        "border border-gray-300 rounded-lg overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

interface TotalsRowProps {
  label?: string;
  value?: string | React.ReactNode;
  children?: React.ReactNode;
  isTotal?: boolean;
  isDiscount?: boolean;
  onRemove?: () => void;
  removing?: boolean;
  className?: string;
}

/**
 * TotalsRow - A row in the totals section (discount, subtotal, total)
 */
export function TotalsRow({
  label,
  value,
  children,
  isTotal = false,
  isDiscount = false,
  onRemove,
  removing = false,
  className,
}: TotalsRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_1fr] border-b border-gray-300 last:border-b-0 group hover:bg-gray-50 transition-colors",
        className
      )}
    >
      <div className="bg-gray-100 border-r border-gray-300 min-h-[44px]" />
      <div className="px-4 py-3 flex items-center justify-between">
        {children || (
          <>
            <span
              className={cn(
                "text-sm",
                isTotal ? "font-medium text-gray-900" : "text-gray-700"
              )}
            >
              {label}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm",
                  isTotal && "font-medium text-gray-900",
                  isDiscount && "text-red-600"
                )}
              >
                {value}
              </span>
              {onRemove && (
                <RemoveButton onClick={onRemove} loading={removing} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
