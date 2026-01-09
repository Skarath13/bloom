"use client";

import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  X,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  Ban,
  Pencil,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  notes: string | null;
  createdAt: Date;
  lastVisitAt: Date | null;
  totalAppointments: number;
  noShows: number;
  cancellations: number;
  updatedAt: Date;
}

interface Appointment {
  id: string;
  date: Date;
  service: string;
  tech: string;
  location: string;
  status: string;
}

interface MobileClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdate: (client: Client) => void;
}

function formatPhone(phone: string) {
  if (!phone) return "";
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}

function formatPhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

async function updateClientAPI(id: string, data: Partial<Client>): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const responseData = await res.json();
  if (!res.ok) throw new Error(responseData.error || "Failed to update client");
  return {
    ...responseData.client,
    createdAt: new Date(responseData.client.createdAt),
    lastVisitAt: responseData.client.lastVisitAt ? new Date(responseData.client.lastVisitAt) : null,
    updatedAt: new Date(responseData.client.updatedAt),
  };
}

async function fetchClientAppointments(clientId: string): Promise<Appointment[]> {
  const res = await fetch(`/api/clients/${clientId}/appointments?limit=5`);
  const data = await res.json();
  if (!res.ok) return [];
  return (data.appointments || []).map((a: {
    id: string;
    startTime: string;
    status: string;
    bloom_services?: { name: string };
    bloom_technicians?: { firstName: string; lastName: string };
    bloom_locations?: { name: string };
  }) => ({
    id: a.id,
    date: new Date(a.startTime),
    service: a.bloom_services?.name || "Unknown Service",
    tech: a.bloom_technicians ? `${a.bloom_technicians.firstName} ${a.bloom_technicians.lastName[0]}.` : "Unknown",
    location: a.bloom_locations?.name || "Unknown Location",
    status: a.status,
  }));
}

export function MobileClientDetailSheet({
  client,
  open,
  onOpenChange,
  onClientUpdate,
}: MobileClientDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [blockReason, setBlockReason] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      setEditForm({
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email || "",
        notes: client.notes || "",
      });
      setBlockReason(client.blockReason || "");
      setIsEditing(false);

      // Fetch appointments
      setIsLoadingAppointments(true);
      fetchClientAppointments(client.id)
        .then(setAppointments)
        .finally(() => setIsLoadingAppointments(false));
    }
  }, [client?.id]);

  const handleSave = async () => {
    if (!client || isSaving) return;

    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.phone.trim()) {
      toast.error("First name, last name, and phone are required");
      return;
    }

    if (editForm.phone.length !== 10) {
      toast.error("Phone number must be 10 digits");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateClientAPI(client.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone,
        email: editForm.email.trim() || null,
        notes: editForm.notes.trim() || null,
      });
      onClientUpdate(updated);
      setIsEditing(false);
      toast.success("Client updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!client || isSaving) return;

    const newBlockedStatus = !client.isBlocked;
    if (newBlockedStatus && !blockReason.trim()) {
      toast.error("Please provide a reason for blocking");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateClientAPI(client.id, {
        isBlocked: newBlockedStatus,
        blockReason: newBlockedStatus ? blockReason : null,
      });
      onClientUpdate(updated);
      toast.success(newBlockedStatus ? "Client blocked" : "Client unblocked");
      if (!newBlockedStatus) setBlockReason("");
    } catch {
      toast.error("Failed to update client");
    } finally {
      setIsSaving(false);
    }
  };

  if (!client) return null;

  const initials = `${client.firstName[0]}${client.lastName[0]}`.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={(o) => {
      if (isSaving) return;
      onOpenChange(o);
      if (!o) setIsEditing(false);
    }}>
      <SheetContent
        side="bottom"
        className="h-full rounded-none p-0 flex flex-col [&>button]:hidden"
      >
        <SheetTitle className="sr-only">
          {isEditing ? "Edit Client" : `${client.firstName} ${client.lastName}`}
        </SheetTitle>
        <SheetDescription className="sr-only">
          View and manage client details
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
            disabled={isSaving}
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">
            {isEditing ? "Edit Client" : "Client Details"}
          </h1>
          {isEditing ? (
            <Button
              variant="ghost"
              className="text-blue-600 font-semibold min-h-[44px] -mr-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            >
              <Pencil className="h-5 w-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            /* Edit Mode */
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">First Name</Label>
                  <Input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Last Name</Label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Phone</Label>
                <Input
                  value={formatPhone(editForm.phone)}
                  onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneInput(e.target.value) })}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  disabled={isSaving}
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          ) : (
            /* View Mode */
            <div className="p-4 space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xl font-semibold text-gray-600">{initials}</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {client.firstName} {client.lastName}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Client since {format(client.createdAt, "MMM yyyy")}
                  </p>
                  <div className="mt-1">
                    {client.isBlocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : client.phoneVerified ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-3">
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100"
                >
                  <Phone className="h-5 w-5 text-gray-500" />
                  <span className="flex-1">{formatPhone(client.phone)}</span>
                  {client.phoneVerified ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </a>
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100"
                  >
                    <Mail className="h-5 w-5 text-gray-500" />
                    <span className="flex-1 truncate">{client.email}</span>
                  </a>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-semibold">{client.totalAppointments}</div>
                  <div className="text-[10px] text-gray-500">Visits</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className={cn("text-xl font-semibold", client.noShows > 0 && "text-red-600")}>
                    {client.noShows}
                  </div>
                  <div className="text-[10px] text-gray-500">No-shows</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-semibold">{client.cancellations}</div>
                  <div className="text-[10px] text-gray-500">Cancelled</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-semibold">
                    {client.lastVisitAt
                      ? formatDistanceToNow(client.lastVisitAt).replace(" ago", "").replace("about ", "").split(" ")[0]
                      : "—"}
                  </div>
                  <div className="text-[10px] text-gray-500">Last visit</div>
                </div>
              </div>

              {/* Block Status */}
              {client.isBlocked && client.blockReason && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                  <Ban className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-red-800">{client.blockReason}</span>
                </div>
              )}

              {/* Notes */}
              {client.notes && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {client.notes}
                  </p>
                </div>
              )}

              {/* Recent Appointments */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Recent Appointments</h3>
                {isLoadingAppointments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No appointments yet</p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-sm">{apt.service}</div>
                          <div className="text-xs text-gray-500">
                            {apt.tech} · {apt.location}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(apt.date, "MMM d")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Block/Unblock */}
              <div className="pt-4 border-t border-gray-200">
                {client.isBlocked ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleToggleBlock}
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Unblock Client
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Reason for blocking..."
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleToggleBlock}
                      disabled={!blockReason.trim() || isSaving}
                    >
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Ban className="h-4 w-4 mr-2" />
                      Block Client
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
