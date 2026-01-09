"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Phone, Loader2, X, User, Clock, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface ClientAppointment {
  id: string;
  serviceName: string;
  technicianName: string;
  startTime: string;
  status: string;
}

interface MobileClientSearchProps {
  selectedClient: Client | null;
  onClientSelect: (client: Client) => void;
  onClientCreate?: (client: Client) => void;
}

// Format phone number as (XXX) XXX-XXXX
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Check if a string looks like a phone number (mostly digits)
function isPhoneQuery(query: string): boolean {
  const digits = query.replace(/\D/g, "");
  return digits.length >= 7;
}

// Sanitize and normalize text input
function sanitizeTextInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// Extract digits from phone string
function extractPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 10);
}

export function MobileClientSearch({
  selectedClient,
  onClientSelect,
  onClientCreate,
}: MobileClientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Client history state
  const [clientHistory, setClientHistory] = useState<ClientAppointment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // New client form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Fetch recent clients on mount
  useEffect(() => {
    fetchRecentClients();
  }, []);

  // Fetch client history when a client is selected
  useEffect(() => {
    if (selectedClient) {
      fetchClientHistory(selectedClient.id);
    } else {
      setClientHistory([]);
    }
  }, [selectedClient]);

  const fetchClientHistory = async (clientId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/appointments?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setClientHistory(data.appointments || []);
      }
    } catch (error) {
      console.error("Failed to fetch client history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Search clients when query changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchClients(searchQuery);
    } else {
      setClients([]);
    }
  }, [searchQuery]);

  const fetchRecentClients = async () => {
    try {
      const res = await fetch("/api/clients?limit=5&sort=recent");
      if (res.ok) {
        const data = await res.json();
        setRecentClients(data.clients || []);
      }
    } catch (error) {
      console.error("Failed to fetch recent clients:", error);
    }
  };

  const searchClients = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Failed to search clients:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleCreateClient = async () => {
    // Sanitize inputs
    const sanitizedFirstName = sanitizeTextInput(newFirstName);
    const sanitizedLastName = sanitizeTextInput(newLastName);
    const sanitizedPhone = extractPhoneDigits(newPhone);
    const sanitizedEmail = newEmail.trim().toLowerCase();
    const sanitizedNotes = newNotes.trim();

    // Validate required fields
    if (!sanitizedFirstName) {
      toast.error("First name is required");
      return;
    }
    if (sanitizedPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate email format if provided
    if (sanitizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: sanitizedFirstName,
          lastName: sanitizedLastName,
          phone: sanitizedPhone,
          email: sanitizedEmail || undefined,
          notes: sanitizedNotes || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create client");
      }

      const data = await res.json();
      const newClient = data.client;

      if (data.existing) {
        toast.info("Client already exists with this phone number");
      } else {
        toast.success("Client created");
      }
      onClientSelect(newClient);
      onClientCreate?.(newClient);

      // Reset form
      setShowNewClientForm(false);
      setNewFirstName("");
      setNewLastName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setSearchQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setIsCreating(false);
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // If a client is already selected, show selection with history
  if (selectedClient) {
    return (
      <div className="bg-white rounded-xl overflow-hidden">
        {/* Client Info Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">
                {selectedClient.firstName} {selectedClient.lastName}
              </h3>
              <p className="text-sm text-gray-500">{formatPhoneDisplay(selectedClient.phone)}</p>
            </div>
            <button
              onClick={() => onClientSelect(null as any)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Client History Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">History</span>
          </div>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : clientHistory.length > 0 ? (
            <div className="space-y-2">
              {clientHistory.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                >
                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {apt.serviceName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(apt.startTime), "MMM d, yyyy")} • {apt.technicianName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      apt.status === "COMPLETED" && "bg-green-100 text-green-700",
                      apt.status === "CONFIRMED" && "bg-blue-100 text-blue-700",
                      apt.status === "NO_SHOW" && "bg-red-100 text-red-700",
                      apt.status === "CANCELLED" && "bg-gray-100 text-gray-600"
                    )}
                  >
                    {apt.status === "COMPLETED" ? "Done" :
                     apt.status === "CONFIRMED" ? "Confirmed" :
                     apt.status === "NO_SHOW" ? "No Show" :
                     apt.status === "CANCELLED" ? "Cancelled" : apt.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-2">No prior appts</p>
          )}
        </div>
      </div>
    );
  }

  // New client form
  if (showNewClientForm) {
    return (
      <div className="bg-white rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">New Client</h3>
          <button
            onClick={() => setShowNewClientForm(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">First Name *</label>
              <Input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="First name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Last Name</label>
              <Input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Phone *</label>
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
              placeholder="(555) 555-5555"
              type="tel"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Email <span className="text-gray-400">(optional)</span></label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Notes <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Add notes about this client..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>
        </div>

        <Button
          onClick={handleCreateClient}
          disabled={isCreating || !newFirstName.trim() || extractPhoneDigits(newPhone).length !== 10}
          className="w-full"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Client
        </Button>
      </div>
    );
  }

  // Search and list view
  const displayClients = searchQuery.length >= 2 ? clients : recentClients;
  const showingRecent = searchQuery.length < 2;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            // Check if input looks like a phone number (starts with digit or parenthesis)
            const isTypingPhone = /^[\d(]/.test(value) || /^\(\d/.test(value);
            if (isTypingPhone) {
              // Format as phone number and limit to 10 digits
              setSearchQuery(formatPhoneInput(value));
            } else {
              setSearchQuery(value);
            }
          }}
          placeholder="Search by name or phone..."
          className="pl-9 h-12"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Client List */}
      <div className="bg-white rounded-xl overflow-hidden">
        {showingRecent && displayClients.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
            Recent Clients
          </div>
        )}

        {displayClients.length > 0 ? (
          <div>
            {displayClients.map((client) => (
              <button
                key={client.id}
                onClick={() => onClientSelect(client)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm text-gray-600">
                    {client.firstName[0]}
                    {client.lastName?.[0] || ""}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {client.firstName} {client.lastName}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhoneDisplay(client.phone)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : searchQuery.length >= 2 && !isSearching ? (
          <div className="p-4 text-center">
            <p className="text-gray-500 text-sm mb-3">No clients found</p>
            {isPhoneQuery(searchQuery) && (
              <button
                onClick={() => {
                  const phoneDigits = extractPhoneDigits(searchQuery);
                  setNewPhone(formatPhoneInput(phoneDigits));
                  setShowNewClientForm(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium active:bg-blue-100"
              >
                <Plus className="h-4 w-4" />
                Create client with {formatPhoneInput(extractPhoneDigits(searchQuery))}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* New Client Button - only show when not actively searching with no results */}
      {!(searchQuery.length >= 2 && displayClients.length === 0 && !isSearching) && (
        <button
          onClick={() => {
            // Pre-fill phone if the search query looks like a phone number
            if (isPhoneQuery(searchQuery)) {
              const phoneDigits = extractPhoneDigits(searchQuery);
              setNewPhone(formatPhoneInput(phoneDigits));
            }
            setShowNewClientForm(true);
          }}
          className="w-full flex items-center justify-center gap-2 p-4 bg-white rounded-xl text-blue-600 font-medium active:bg-gray-50"
        >
          <Plus className="h-5 w-5" />
          New Client
        </button>
      )}
    </div>
  );
}
