"use client";

import { cn } from "@/lib/utils";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface MobileTechnicianRowProps {
  technicians: Technician[];
  selectedTechIds: string[];
  onTechSelect: (techId: string) => void;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function MobileTechnicianRow({
  technicians,
  selectedTechIds,
  onTechSelect,
}: MobileTechnicianRowProps) {
  if (technicians.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 px-3 py-2" style={{ WebkitOverflowScrolling: "touch" }}>
        {technicians.map((tech) => {
          const isSelected = selectedTechIds.includes(tech.id);
          const initials = getInitials(tech.firstName, tech.lastName);

          return (
            <button
              key={tech.id}
              onClick={() => onTechSelect(tech.id)}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                "text-xs font-bold transition-all active:scale-95",
                "min-w-[40px]" // Ensure touch target
              )}
              style={{
                backgroundColor: isSelected ? tech.color : "transparent",
                color: isSelected ? "white" : tech.color,
                border: `2px solid ${tech.color}`,
              }}
              title={`${tech.firstName} ${tech.lastName}`}
            >
              {initials}
            </button>
          );
        })}
      </div>
    </div>
  );
}
