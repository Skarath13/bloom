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

// Mobile service shorthand (4 letters per word, max 2 words)
const SERVICE_SHORTHAND: Record<string, string> = {
  "Anime/Manga Set": "Anim Set",
  "Brow Lamination + Tint": "Brow Lam",
  "Brow Shaping": "Brow Shp",
  "Elegant Volume Fill": "Eleg Fill",
  "Elegant Volume Set": "Eleg Set",
  "Everyday Glow Facial": "Glow Fcl",
  "Eyebrow Tattooing": "Brow Tat",
  "Eyebrow Wax": "Brow Wax",
  "Eyeliner Bottom": "Linr Btm",
  "Eyeliner Top Line": "Linr Top",
  "Fix - 3 Days or Under": "Fix",
  "Foreign Lash Fill": "Frgn Fill",
  "Full Arm Wax": "Full Arm",
  "Full Body Wax": "Full Body",
  "Full Face Wax": "Full Face",
  "Full Leg + Brazilian Wax": "Leg+Braz",
  "Full Leg Wax": "Full Leg",
  "Full Lips": "Full Lips",
  "Hair Stroke (Girl)": "Hair Girl",
  "Hair Stroke (Man)": "Hair Man",
  "Half Arm Wax": "Half Arm",
  "Half Leg Wax": "Half Leg",
  "Lash Fill with Katie": "Fill Kate",
  "Lash Lift": "Lift",
  "Lash Lift + Tint": "Lift Tint",
  "Lash Removal": "Removal",
  "Lash Tint": "Tint",
  "Lip Blush": "Lip Blsh",
  "Lip Liner": "Lip Linr",
  "Mega Volume Fill": "Mega Fill",
  "Mega Volume Set": "Mega Set",
  "Microblading Brows": "Micr Brow",
  "Natural Fill": "Nat Fill",
  "Natural Hybrid Set (New Client)": "Nat Hybr",
  "Natural Set (Hybrid)": "Nat Set",
  "Natural Wet Set (New Client)": "Nat Wet",
  "Ombre Brow": "Ombr Brow",
  "Ombre with Hair Stroke": "Ombr Hair",
  "One Week Touch-Up/Fill": "1Wk Fill",
  "Permanent Eyeliner": "Perm Linr",
  "Red Carpet Glow Facial - HydraFacial": "Hydr Fcl",
  "Super Mega Volume Set": "SMeg Set",
  "Top and Bottom Lash Fill": "T+B Fill",
  "Top & Bottom Lash Set": "T+B Set",
  "Underarm + Brazilian Wax": "Undr+Brz",
  "Underarm Wax": "Undr Wax",
  "Wispy Elegant Set": "Wisp Eleg",
  "Wispy Wet Set": "Wisp Wet",
};

// Get shorthand or truncate if not found
const getServiceShorthand = (name: string): string => {
  return SERVICE_SHORTHAND[name] || name.slice(0, 9);
};

interface AppointmentCardProps {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  serviceCategory?: string;
  status: string;
  techColor?: string; // Technician's assigned color
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
    disabled: !draggable,
  });

  // Use z-index from overlap position or style
  const effectiveZIndex = overlapPosition?.zIndex ?? (style?.zIndex as number | undefined) ?? 10;

  // Determine background color
  const bgColor = techColor || TECH_COLOR_PALETTE[0];

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

  // Mobile horizontal stacked layout
  if (config.isMobile) {
    return (
      <div
        ref={setNodeRef}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
        className={cn(
          "absolute rounded px-1.5 py-0.5 overflow-hidden cursor-pointer",
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
        {/* Status indicator - bottom right */}
        {statusIndicator && (
          <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded bg-white flex items-center justify-center">
            {statusIndicator === "?" && (
              <span
                className="text-[10px] leading-none"
                style={{ color: bgColor, fontWeight: 900, WebkitTextStroke: `0.5px ${bgColor}` }}
              >?</span>
            )}
            {statusIndicator === "check" && (
              <Check className="h-2.5 w-2.5" style={{ color: bgColor }} strokeWidth={4.5} fill="none" />
            )}
            {statusIndicator === "checkcheck" && (
              <CheckCheck className="h-2.5 w-2.5" style={{ color: bgColor }} strokeWidth={4} fill="none" />
            )}
            {statusIndicator === "user" && (
              <User className="h-2.5 w-2.5" style={{ color: bgColor }} strokeWidth={4} fill="none" />
            )}
            {statusIndicator === "play" && (
              <Play className="h-2 w-2" style={{ color: bgColor }} strokeWidth={4} fill="none" />
            )}
            {statusIndicator === "x" && (
              <X className="h-2.5 w-2.5" style={{ color: bgColor }} strokeWidth={4} fill="none" />
            )}
          </div>
        )}

        {/* Stacked content: time, name, service */}
        <div className="flex flex-col text-[10px] leading-tight text-white">
          {/* Time */}
          <div className="font-bold">
            {format(startTime, "h:mm")}
          </div>
          {/* Client name - first 4 letters of first name, then last name */}
          {(() => {
            const names = clientName.split(' ');
            const firstName = names[0]?.slice(0, 4) || '';
            const lastName = names[names.length - 1]?.slice(0, 4) || '';
            return (
              <>
                <div className="font-medium">{firstName}</div>
                <div className="font-medium">{lastName !== firstName ? lastName : ''}</div>
              </>
            );
          })()}
          {/* Service shorthand - split into 2 lines */}
          {serviceName && showServiceName && (() => {
            const shorthand = getServiceShorthand(serviceName);
            const words = shorthand.split(' ');
            return (
              <>
                <div className="text-white/80">{words[0]}</div>
                {words[1] && <div className="text-white/80">{words[1]}</div>}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Desktop layout (unchanged)
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
        "text-xs pr-5"
      )}>
        {format(startTime, "h:mm a")}
      </div>

      {/* Client name */}
      <div className={cn(
        "text-white font-medium truncate",
        "text-xs"
      )}>
        {clientName}
      </div>

      {/* Service name (if height allows) */}
      {showServiceName && (
        <div className="text-white/90 text-xs truncate">
          {serviceName}
        </div>
      )}

      {/* Service category with sparkle (if height allows) */}
      {showCategory && serviceCategory && (
        <div className="text-white/80 text-xs flex items-center gap-0.5">
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
