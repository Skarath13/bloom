"use client";

import { format } from "date-fns";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Square-style appointment colors
export const APPOINTMENT_COLORS = {
  CONFIRMED: "#7CB342", // Lime green
  PENDING: "#7CB342", // Same green but with opacity
  CHECKED_IN: "#26A69A", // Teal
  IN_PROGRESS: "#42A5F5", // Blue
  COMPLETED: "#9E9E9E", // Gray
  CANCELLED: "#E0E0E0", // Light gray
  NO_SHOW: "#EF5350", // Red
  PERSONAL: "#FFC107", // Amber/Yellow for blocks
} as const;

interface AppointmentCardProps {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  serviceCategory?: string;
  status: string;
  isPersonalBlock?: boolean;
  height: number; // Height in pixels
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function AppointmentCard({
  startTime,
  clientName,
  serviceName,
  serviceCategory,
  status,
  isPersonalBlock = false,
  height,
  onClick,
  style,
  className,
}: AppointmentCardProps) {
  // Determine background color based on status
  const getBackgroundColor = () => {
    if (isPersonalBlock) return APPOINTMENT_COLORS.PERSONAL;

    switch (status) {
      case "CONFIRMED":
        return APPOINTMENT_COLORS.CONFIRMED;
      case "PENDING":
        return APPOINTMENT_COLORS.PENDING;
      case "CHECKED_IN":
        return APPOINTMENT_COLORS.CHECKED_IN;
      case "IN_PROGRESS":
        return APPOINTMENT_COLORS.IN_PROGRESS;
      case "COMPLETED":
        return APPOINTMENT_COLORS.COMPLETED;
      case "CANCELLED":
        return APPOINTMENT_COLORS.CANCELLED;
      case "NO_SHOW":
        return APPOINTMENT_COLORS.NO_SHOW;
      default:
        return APPOINTMENT_COLORS.CONFIRMED;
    }
  };

  const bgColor = getBackgroundColor();
  const isPending = status === "PENDING";
  const isConfirmed = status === "CONFIRMED";
  const showCheckbox = isConfirmed || status === "CHECKED_IN";

  // Determine what content to show based on card height
  const showServiceName = height > 40;
  const showCategory = height > 55;

  return (
    <div
      className={cn(
        "absolute rounded px-1.5 py-1 overflow-hidden cursor-pointer",
        "transition-all hover:brightness-110",
        className
      )}
      style={{
        backgroundColor: bgColor,
        opacity: isPending ? 0.7 : 1,
        ...style,
      }}
      onClick={onClick}
    >
      {/* Checkbox indicator for confirmed appointments */}
      {showCheckbox && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded border border-white/50 flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Time */}
      <div className="text-xs font-medium text-white pr-5">
        {format(startTime, "h:mm a")}
      </div>

      {/* Client name */}
      <div className="text-xs text-white font-medium truncate">
        {isPersonalBlock ? "Personal Event" : clientName}
      </div>

      {/* Service name (if height allows) */}
      {showServiceName && !isPersonalBlock && (
        <div className="text-xs text-white/90 truncate">
          {serviceName}
        </div>
      )}

      {/* Service category with sparkle (if height allows) */}
      {showCategory && serviceCategory && !isPersonalBlock && (
        <div className="text-xs text-white/80 flex items-center gap-0.5 truncate">
          ({serviceCategory})
          <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />
        </div>
      )}
    </div>
  );
}

// Helper function to calculate overlap positions for appointments
export function calculateOverlapPositions(
  appointments: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
  }>
): Map<string, { left: number; width: number }> {
  const positions = new Map<string, { left: number; width: number }>();

  // Sort appointments by start time
  const sorted = [...appointments].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // Find overlapping groups
  const groups: Array<typeof sorted> = [];
  let currentGroup: typeof sorted = [];

  for (const apt of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(apt);
    } else {
      // Check if this appointment overlaps with any in the current group
      const overlaps = currentGroup.some(
        (groupApt) =>
          apt.startTime < groupApt.endTime && apt.endTime > groupApt.startTime
      );

      if (overlaps) {
        currentGroup.push(apt);
      } else {
        // No overlap, start a new group
        groups.push(currentGroup);
        currentGroup = [apt];
      }
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Calculate positions for each group
  for (const group of groups) {
    const width = 100 / group.length;
    group.forEach((apt, index) => {
      positions.set(apt.id, {
        left: index * width,
        width: width,
      });
    });
  }

  return positions;
}
