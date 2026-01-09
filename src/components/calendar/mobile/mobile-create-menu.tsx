"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type EventType = "appointment" | "class" | "personal_event";

interface MobileCreateMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEvent: (type: EventType) => void;
  children?: React.ReactNode;
}

const menuItems: { type: EventType; label: string }[] = [
  { type: "appointment", label: "Create appointment" },
  { type: "personal_event", label: "Create personal event" },
];

export function MobileCreateMenu({
  open,
  onOpenChange,
  onCreateEvent,
  children,
}: MobileCreateMenuProps) {
  const handleSelect = (type: EventType) => {
    onCreateEvent(type);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children || (
          <button
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center",
              "rounded-full active:bg-gray-100 transition-colors"
            )}
            aria-label="Create new"
          >
            <Plus className="h-7 w-7 text-gray-700" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        alignOffset={-8}
        className="w-[220px] p-0 rounded-xl shadow-lg border border-gray-200"
      >
        <div className="py-2">
          {menuItems.map((item, index) => (
            <button
              key={item.type}
              onClick={() => handleSelect(item.type)}
              className={cn(
                "w-full text-left px-4 py-3 text-base text-gray-900",
                "active:bg-gray-100 transition-colors",
                "min-h-[48px]",
                index !== menuItems.length - 1 && "border-b border-gray-100"
              )}
            >
              {item.label}
            </button>
          ))}

          {/* Cancel button */}
          <button
            onClick={() => onOpenChange(false)}
            className={cn(
              "w-full text-left px-4 py-3 text-base text-gray-500",
              "active:bg-gray-100 transition-colors",
              "min-h-[48px] border-t border-gray-200 mt-1"
            )}
          >
            Cancel
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
