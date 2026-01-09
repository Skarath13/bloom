"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MobileClientCard } from "./mobile-client-card";
import { MobileClientDetailSheet } from "./mobile-client-detail-sheet";

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

type FilterTab = "all" | "active" | "blocked";

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

async function fetchClients(params: {
  search?: string;
  filter?: string;
}): Promise<Client[]> {
  const searchParams = new URLSearchParams({
    page: "1",
    pageSize: "100", // Load more on mobile for smooth scrolling
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.filter) searchParams.set("filter", params.filter);

  const res = await fetch(`/api/clients?${searchParams}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch clients");

  return (data.clients || []).map((c: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    phoneVerified: boolean;
    isBlocked: boolean;
    blockReason: string | null;
    notes: string | null;
    createdAt: string;
    lastVisitAt: string | null;
    updatedAt: string;
    totalAppointments: number;
    noShows: number;
    cancellations: number;
  }) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    lastVisitAt: c.lastVisitAt ? new Date(c.lastVisitAt) : null,
    updatedAt: new Date(c.updatedAt),
  }));
}

export function MobileClientsLayout() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchRequestId = useRef(0);

  const loadClients = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setIsLoading(true);

    try {
      const result = await fetchClients({
        search: searchQuery || undefined,
        filter: activeFilter,
      });

      if (requestId === fetchRequestId.current) {
        setClients(result);
      }
    } catch {
      if (requestId === fetchRequestId.current) {
        setClients([]);
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Search will trigger via useEffect
    }, 300);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
  };

  const handleClientUpdate = (updatedClient: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
    );
    setSelectedClient(updatedClient);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between h-14 px-4">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search clients..."
                  className="pl-9 h-10"
                />
              </div>
              <button
                onClick={clearSearch}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Clients</h1>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              >
                <Search className="h-5 w-5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeFilter === tab.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p>No clients found</p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-2 text-blue-600 text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white">
            {clients.map((client) => (
              <MobileClientCard
                key={client.id}
                client={client}
                onClick={() => handleClientClick(client)}
              />
            ))}
          </div>
        )}

        {/* Bottom padding for nav */}
        <div className="h-20" />
      </div>

      {/* Client Detail Sheet */}
      <MobileClientDetailSheet
        client={selectedClient}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onClientUpdate={handleClientUpdate}
      />
    </div>
  );
}
