"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Clock, Loader2, MessageSquare, Sparkles, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  technicianId: string;
  client?: {
    phone?: string;
  };
}

interface MoveConfirmationModalProps {
  appointment: Appointment;
  originalTime: Date;
  newTime: Date;
  originalTechId: string;
  newTechId: string;
  technicians: Technician[];
  onConfirm: (notifyClient: boolean) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function MoveConfirmationModal({
  appointment,
  originalTime,
  newTime,
  originalTechId,
  newTechId,
  technicians,
  onConfirm,
  onCancel,
  isLoading,
}: MoveConfirmationModalProps) {
  const [notifyClient, setNotifyClient] = useState(false);

  const originalTech = technicians.find((t) => t.id === originalTechId);
  const newTech = technicians.find((t) => t.id === newTechId);
  const techChanged = originalTechId !== newTechId;
  const timeChanged = originalTime.getTime() !== newTime.getTime();

  // Calculate new end time based on original duration
  const duration = appointment.endTime.getTime() - appointment.startTime.getTime();
  const newEndTime = new Date(newTime.getTime() + duration);

  const handleConfirm = async () => {
    await onConfirm(notifyClient);
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-5">
          {/* Header */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Move Appointment</h3>
          <p className="text-sm text-gray-500 mb-5">
            {appointment.clientName} · {appointment.serviceName}
          </p>

          {/* Changes summary */}
          <div className="space-y-3 mb-5">
            {/* Time change */}
            {timeChanged && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 line-through">
                    {format(originalTime, "h:mm a")}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                  <span className="text-gray-900 font-medium">
                    {format(newTime, "h:mm a")}
                  </span>
                </div>
              </div>
            )}

            {/* Technician change */}
            {techChanged && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 line-through flex items-center gap-1">
                    {originalTech?.firstName}
                    <Sparkles className="h-3 w-3" style={{ color: originalTech?.color }} />
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                  <span className="text-gray-900 font-medium flex items-center gap-1">
                    {newTech?.firstName}
                    <Sparkles className="h-3 w-3" style={{ color: newTech?.color }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SMS notification toggle */}
          {appointment.client?.phone && (
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-700">Notify via SMS</p>
                  <p className="text-xs text-gray-400">{formatPhone(appointment.client.phone)}</p>
                </div>
              </div>
              <Switch
                checked={notifyClient}
                onCheckedChange={setNotifyClient}
              />
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer border-r border-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
