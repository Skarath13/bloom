"use client";

import { format } from "date-fns";
import { Check, CheckCheck, Sparkles, User, Play, X } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useCalendarConfig } from "./calendar-config";
import type { OverlapPosition } from "./overlap-utils";

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
  overlapPosition?: OverlapPosition; // For unified overlap handling
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
  overlapPosition,
}: AppointmentCardProps) {
  const config = useCalendarConfig();

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

  // Use z-index from overlap position or style
  const effectiveZIndex = overlapPosition?.zIndex ?? (style?.zIndex as number | undefined) ?? 10;

  // Determine background color - personal events are gray, appointments use tech color
  const bgColor = isPersonalEvent ? PERSONAL_EVENT_COLOR : (techColor || TECH_COLOR_PALETTE[0]);

  // Ghost appearance for cancelled/no-show (reduced opacity)
  const isGhost = status === "CANCELLED" || status === "NO_SHOW";

  // Status indicator config - all use card's bgColor for cohesive look
  const statusIndicator = {
    PENDING: "?",
    CONFIRMED: "check",
    CHECKED_IN: "user",
    IN_PROGRESS: "play",
    COMPLETED: "checkcheck",
    CANCELLED: "x",
    NO_SHOW: "x",
  }[status] as string | undefined;

  // Determine what content to show based on card height (smaller thresholds on mobile)
  const showServiceName = height > (config.isMobile ? 32 : 40);
  const showCategory = height > (config.isMobile ? 45 : 55);

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={cn(
        "absolute rounded px-1.5 py-1 overflow-hidden cursor-pointer",
        isDragging && "opacity-0 pointer-events-none",
        draggable && "touch-none",
        className
      )}
      style={{
        backgroundColor: bgColor,
        opacity: isGhost ? 0.5 : isDragging ? 0 : 1,
        ...style,
        zIndex: effectiveZIndex,
      }}
      onClick={onClick}
    >
      {/* Status indicator - white box with icon matching card color */}
      {statusIndicator && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded bg-white flex items-center justify-center">
          {statusIndicator === "?" && (
            <span
              className="text-[12px] leading-none"
              style={{ color: bgColor, fontWeight: 900, WebkitTextStroke: `0.5px ${bgColor}` }}
            >?</span>
          )}
          {statusIndicator === "check" && (
            <Check className="h-3 w-3" style={{ color: bgColor }} strokeWidth={4.5} fill="none" />
          )}
          {statusIndicator === "checkcheck" && (
            <CheckCheck className="h-3 w-3" style={{ color: bgColor }} strokeWidth={4} fill="none" />
          )}
          {statusIndicator === "user" && (
            <User className="h-3 w-3" style={{ color: bgColor }} strokeWidth={4} fill="none" />
          )}
          {statusIndicator === "play" && (
            <Play className="h-2.5 w-2.5" style={{ color: bgColor }} strokeWidth={4} fill="none" />
          )}
          {statusIndicator === "x" && (
            <X className="h-3 w-3" style={{ color: bgColor }} strokeWidth={4} fill="none" />
          )}
        </div>
      )}

      {/* Time */}
      <div className={cn(
        "font-medium text-white",
        config.isMobile ? "text-[10px] pr-4" : "text-xs pr-5"
      )}>
        {format(startTime, "h:mm a")}
      </div>

      {/* Client name */}
      <div className={cn(
        "text-white font-medium truncate",
        config.isMobile ? "text-[10px]" : "text-xs"
      )}>
        {isPersonalEvent ? "Personal Event" : clientName}
      </div>

      {/* Service name (if height allows) */}
      {showServiceName && !isPersonalEvent && (
        <div className={cn(
          "text-white/90",
          config.isMobile ? "text-[10px] break-words leading-tight" : "text-xs truncate"
        )}>
          {serviceName}
        </div>
      )}

      {/* Service category with sparkle (if height allows) */}
      {showCategory && serviceCategory && !isPersonalEvent && (
        <div className={cn(
          "text-white/80 flex items-center gap-0.5",
          config.isMobile ? "text-[10px]" : "text-xs"
        )}>
          ({serviceCategory})
          {config.showSparkles && <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />}
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
