"use client";

import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  onClick?: () => void;
  draggable?: boolean;
  isBeingDragged?: boolean;
}

export function BlockCard({
  block,
  style,
  onClick,
  draggable = true,
  isBeingDragged = false,
}: BlockCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { block, type: "block" },
    disabled: !draggable,
  });

  // Hide if being dragged (either from local isDragging or parent's isBeingDragged)
  const shouldHide = isDragging || isBeingDragged;

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={cn(
        "absolute rounded px-1.5 py-1 overflow-hidden cursor-pointer transition-all hover:brightness-110 pointer-events-auto",
        shouldHide && "opacity-0 pointer-events-none",
        draggable && "touch-none"
      )}
      style={{
        top: style.top,
        height: style.height,
        left: "2px",
        right: "2px",
        backgroundColor: "#9E9E9E",
        opacity: shouldHide ? 0 : 1,
      }}
      onClick={onClick}
    >
      <div className="text-xs font-medium text-white">
        {format(block.startTime, "h:mm a")}
      </div>
      <div className="text-xs text-white font-medium">
        {block.title}
      </div>
    </div>
  );
}
