"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Calendar, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Move Appointment</h3>
          </div>

          {/* Client info */}
          <p className="text-gray-600 mb-4">
            Move appointment for{" "}
            <span className="font-medium">{appointment.clientName}</span>?
          </p>

          {/* Service info */}
          <p className="text-sm text-gray-500 mb-4">{appointment.serviceName}</p>

          {/* Time change display */}
          {timeChanged && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                Time
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700">
                  {format(originalTime, "h:mm a")}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="text-blue-600 font-medium">
                  {format(newTime, "h:mm a")}
                </span>
              </div>
            </div>
          )}

          {/* Technician change display */}
          {techChanged && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                Staff
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 flex items-center gap-1">
                  {originalTech?.firstName}
                  <Sparkles
                    className="h-3 w-3"
                    style={{ color: originalTech?.color }}
                  />
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="text-blue-600 font-medium flex items-center gap-1">
                  {newTech?.firstName}
                  <Sparkles
                    className="h-3 w-3"
                    style={{ color: newTech?.color }}
                  />
                </span>
              </div>
            </div>
          )}

          {/* SMS notification checkbox */}
          {appointment.client?.phone && (
            <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <Checkbox
                checked={notifyClient}
                onCheckedChange={(checked) => setNotifyClient(checked === true)}
                className="border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-900">
                    Notify client via SMS
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send text to {formatPhone(appointment.client.phone)}
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="h-9 px-4 rounded-full border border-gray-300 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Move Appointment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
