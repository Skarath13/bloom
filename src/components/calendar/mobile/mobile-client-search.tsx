"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Phone, Check, Loader2, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface MobileClientSearchProps {
  selectedClient: Client | null;
  onClientSelect: (client: Client) => void;
  onClientCreate?: (client: Client) => void;
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

  // New client form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Fetch recent clients on mount
  useEffect(() => {
    fetchRecentClients();
  }, []);

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
    if (!newFirstName.trim() || !newPhone.trim()) {
      toast.error("First name and phone are required");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create client");
      }

      const data = await res.json();
      const newClient = data.client;

      toast.success("Client created");
      onClientSelect(newClient);
      onClientCreate?.(newClient);

      // Reset form
      setShowNewClientForm(false);
      setNewFirstName("");
      setNewLastName("");
      setNewPhone("");
      setNewEmail("");
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

  // If a client is already selected, show selection
  if (selectedClient) {
    return (
      <div className="bg-white rounded-xl p-4">
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
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="(555) 555-5555"
              type="tel"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Email</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
            />
          </div>
        </div>

        <Button
          onClick={handleCreateClient}
          disabled={isCreating || !newFirstName.trim() || !newPhone.trim()}
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
          onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="p-4 text-center text-gray-500 text-sm">
            No clients found
          </div>
        ) : null}
      </div>

      {/* New Client Button */}
      <button
        onClick={() => setShowNewClientForm(true)}
        className="w-full flex items-center justify-center gap-2 p-4 bg-white rounded-xl text-blue-600 font-medium active:bg-gray-50"
      >
        <Plus className="h-5 w-5" />
        New Client
      </button>
    </div>
  );
}
