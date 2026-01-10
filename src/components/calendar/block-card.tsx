"use client";

import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { OverlapPosition } from "./overlap-utils";
import { useCalendarConfig } from "./calendar-config";

interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
}

interface BlockCardProps {
  block: TechnicianBlock;
  style: {
    top: string;
    height: string;
  };
  overlapPosition?: OverlapPosition;
  onClick?: () => void;
  draggable?: boolean;
  isBeingDragged?: boolean;
}

export function BlockCard({
  block,
  style,
  overlapPosition,
  onClick,
  draggable = true,
  isBeingDragged = false,
}: BlockCardProps) {
  const config = useCalendarConfig();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { block, type: "block" },
    disabled: !draggable,
  });

  // Hide if being dragged (either from local isDragging or parent's isBeingDragged)
  const shouldHide = isDragging || isBeingDragged;

  // Calculate left/width from overlap position (fallback to full width)
  const left = overlapPosition?.left ?? 0;
  const width = overlapPosition?.width ?? 100;
  const zIndex = overlapPosition?.zIndex ?? 10;

  // Standard layout (mobile and desktop)
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={cn(
        "absolute rounded px-1.5 py-0.5 overflow-hidden cursor-pointer pointer-events-auto",
        shouldHide && "opacity-0 pointer-events-none",
        draggable && "touch-none"
      )}
      style={{
        top: style.top,
        height: style.height,
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - ${width < 100 ? 4 : 4}px)`,
        zIndex,
        backgroundColor: "#C8C8C8",
        opacity: shouldHide ? 0 : 1,
      }}
      onClick={onClick}
    >
      <div className={cn(
        "font-medium text-gray-700",
        config.isMobile ? "text-[10px]" : "text-xs"
      )}>
        {format(block.startTime, config.isMobile ? "h:mm" : "h:mm a")}
      </div>
      <div className={cn(
        "text-gray-700 font-medium",
        config.isMobile ? "text-[10px]" : "text-xs"
      )}>
        {block.title}
      </div>
    </div>
  );
}
