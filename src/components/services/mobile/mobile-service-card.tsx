"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  isVariablePrice: boolean;
  imageUrl: string | null;
}

interface MobileServiceCardProps {
  service: Service;
  onClick: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatPrice(price: number, isVariable: boolean): string {
  if (isVariable) return `From $${price}`;
  return `$${price}`;
}

export function MobileServiceCard({ service, onClick }: MobileServiceCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 bg-white",
        "active:bg-gray-50 transition-colors",
        "border-b border-gray-100",
        !service.isActive && "opacity-60"
      )}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-lg text-gray-400">
            {service.name[0].toUpperCase()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {service.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
          <span>{formatDuration(service.durationMinutes)}</span>
          <span>·</span>
          <span>{formatPrice(service.price, service.isVariablePrice)}</span>
        </div>
        <div className="mt-1">
          {service.isActive ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-600">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Inactive
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}
