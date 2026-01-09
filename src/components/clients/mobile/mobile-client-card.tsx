"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRight, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneVerified: boolean;
  isBlocked: boolean;
  lastVisitAt: Date | null;
  totalAppointments: number;
  noShows: number;
}

interface MobileClientCardProps {
  client: Client;
  onClick: () => void;
}

function formatPhone(phone: string) {
  if (!phone) return "";
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}

function getStatusBadge(client: Client) {
  if (client.isBlocked) {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Blocked</Badge>;
  }
  if (!client.phoneVerified) {
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Unverified</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-600">Active</Badge>;
}

export function MobileClientCard({ client, onClick }: MobileClientCardProps) {
  const initials = `${client.firstName[0]}${client.lastName[0]}`.toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 bg-white",
        "active:bg-gray-50 transition-colors",
        "border-b border-gray-100",
        client.isBlocked && "opacity-60"
      )}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-medium text-gray-600">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {client.firstName} {client.lastName}
          </span>
          {client.phoneVerified ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{formatPhone(client.phone)}</span>
          <span>·</span>
          <span>
            {client.lastVisitAt
              ? formatDistanceToNow(client.lastVisitAt, { addSuffix: true })
              : "No visits"}
          </span>
        </div>
        <div className="mt-1">
          {getStatusBadge(client)}
          {client.noShows > 0 && (
            <span className="text-[10px] text-red-600 ml-2">
              {client.noShows} no-show{client.noShows > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}
