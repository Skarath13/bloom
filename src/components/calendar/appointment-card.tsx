"use client";

import { format } from "date-fns";
import { Check, Sparkles } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

// Default color palette for technicians (15 distinct earth tones/pastels)
export const TECH_COLOR_PALETTE = [
  "#7CB342", // Sage Green
  "#E07A5F", // Terracotta
  "#5B8FA8", // Dusty Blue
  "#9B72AA", // Lavender Purple
  "#E9967A", // Coral/Salmon
  "#2A9D8F", // Teal
  "#C48B9F", // Dusty Rose
  "#6B8E4E", // Olive
  "#C9A66B", // Sand/Tan
  "#6B7A8F", // Slate Blue
  "#B4838D", // Mauve
  "#4A7C59", // Forest Green
  "#8B8589", // Warm Gray
  "#BC6C49", // Burnt Sienna
  "#7B8DC1", // Periwinkle
] as const;

// Color for personal events
const PERSONAL_EVENT_COLOR = "#9E9E9E"; // Gray

interface AppointmentCardProps {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  serviceCategory?: string;
  status: string;
  techColor?: string; // Technician's assigned color
  isPersonalEvent?: boolean;
  height: number; // Height in pixels
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  draggable?: boolean; // Enable drag and drop
  technicianId?: string; // Required for drag data
}

export function AppointmentCard({
  id,
  startTime,
  endTime,
  clientName,
  serviceName,
  serviceCategory,
  status,
  techColor,
  isPersonalEvent = false,
  height,
  onClick,
  style,
  className,
  draggable = false,
  technicianId,
}: AppointmentCardProps) {
  // Drag and drop hook
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      type: "appointment",
      appointment: {
        id,
        startTime,
        endTime,
        clientName,
        serviceName,
        serviceCategory,
        technicianId,
        status,
      },
    },
    disabled: !draggable || isPersonalEvent,
  });

  // Determine background color - personal events are gray, appointments use tech color
  const bgColor = isPersonalEvent ? PERSONAL_EVENT_COLOR : (techColor || TECH_COLOR_PALETTE[0]);

  // Ghost appearance for cancelled/no-show (reduced opacity)
  const isGhost = status === "CANCELLED" || status === "NO_SHOW";

  const isPending = status === "PENDING";
  const isConfirmed = status === "CONFIRMED";
  const showCheckbox = isConfirmed;

  // Determine what content to show based on card height
  const showServiceName = height > 40;
  const showCategory = height > 55;

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={cn(
        "absolute rounded px-1.5 py-1 overflow-hidden cursor-pointer",
        "transition-all hover:brightness-110",
        isDragging && "pointer-events-none",
        draggable && "touch-none",
        className
      )}
      style={{
        backgroundColor: bgColor,
        opacity: isGhost ? 0.5 : isDragging ? 0.3 : 1,
        ...style,
      }}
      onClick={onClick}
    >
      {/* Checkbox indicator for confirmed appointments - white box with colored check */}
      {showCheckbox && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded bg-white flex items-center justify-center">
          <Check className="h-3 w-3" style={{ color: bgColor }} strokeWidth={6} />
        </div>
      )}

      {/* Question mark indicator for pending appointments - white box with colored ? */}
      {isPending && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded bg-white flex items-center justify-center">
          <span
            className="text-[12px] font-black leading-none"
            style={{
              color: bgColor,
              WebkitTextStroke: `0.5px ${bgColor}`,
            }}
          >?</span>
        </div>
      )}

      {/* Time */}
      <div className="text-xs font-medium text-white pr-5">
        {format(startTime, "h:mm a")}
      </div>

      {/* Client name */}
      <div className="text-xs text-white font-medium truncate">
        {isPersonalEvent ? "Personal Event" : clientName}
      </div>

      {/* Service name (if height allows) */}
      {showServiceName && !isPersonalEvent && (
        <div className="text-xs text-white/90 truncate">
          {serviceName}
        </div>
      )}

      {/* Service category with sparkle (if height allows) */}
      {showCategory && serviceCategory && !isPersonalEvent && (
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
