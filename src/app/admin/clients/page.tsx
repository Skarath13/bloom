"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Phone, AlertTriangle, CheckCircle, Ban, MessageSquare, Pencil, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

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
  updatedAt: Date; // For optimistic locking / conflict detection
}

interface EditFormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface Appointment {
  id: string;
  date: Date;
  service: string;
  tech: string;
  location: string;
  status: string;
}

// ============================================================================
// Mock Data (will be replaced by API calls)
// ============================================================================

const mockClientsData: Client[] = [
  {
    id: "client-1",
    firstName: "Jennifer",
    lastName: "Smith",
    phone: "9495551234",
    email: "jennifer.smith@email.com",
    phoneVerified: true,
    isBlocked: false,
    blockReason: null,
    notes: "Prefers natural look. Sensitive eyes.",
    createdAt: new Date("2024-01-15"),
    lastVisitAt: new Date("2024-12-20"),
    totalAppointments: 12,
    noShows: 0,
    cancellations: 1,
    updatedAt: new Date("2024-12-20"),
  },
  {
    id: "client-2",
    firstName: "Michelle",
    lastName: "Johnson",
    phone: "9495555678",
    email: "michelle.j@email.com",
    phoneVerified: true,
    isBlocked: false,
    blockReason: null,
    notes: "VIP client. Always tips well.",
    createdAt: new Date("2023-06-01"),
    lastVisitAt: new Date("2024-12-15"),
    totalAppointments: 24,
    noShows: 0,
    cancellations: 0,
    updatedAt: new Date("2024-12-15"),
  },
  {
    id: "client-3",
    firstName: "Amanda",
    lastName: "Williams",
    phone: "9495559012",
    email: "amanda.w@email.com",
    phoneVerified: true,
    isBlocked: true,
    blockReason: "Multiple no-shows without notice",
    notes: null,
    createdAt: new Date("2024-03-10"),
    lastVisitAt: new Date("2024-09-01"),
    totalAppointments: 5,
    noShows: 3,
    cancellations: 1,
    updatedAt: new Date("2024-09-01"),
  },
  {
    id: "client-4",
    firstName: "Sarah",
    lastName: "Davis",
    phone: "9495553456",
    email: null,
    phoneVerified: true,
    isBlocked: false,
    blockReason: null,
    notes: "Allergic to certain adhesives. Use sensitive formula.",
    createdAt: new Date("2024-08-20"),
    lastVisitAt: new Date("2024-12-18"),
    totalAppointments: 4,
    noShows: 0,
    cancellations: 0,
    updatedAt: new Date("2024-12-18"),
  },
  {
    id: "client-5",
    firstName: "Emily",
    lastName: "Brown",
    phone: "9495557890",
    email: "emily.brown@email.com",
    phoneVerified: false,
    isBlocked: false,
    blockReason: null,
    notes: null,
    createdAt: new Date("2024-12-01"),
    lastVisitAt: null,
    totalAppointments: 0,
    noShows: 0,
    cancellations: 0,
    updatedAt: new Date("2024-12-01"),
  },
];

const mockAppointments: Appointment[] = [
  { id: "apt-1", date: new Date("2024-12-20"), service: "Elegant Volume Set", tech: "Katie M.", location: "Irvine", status: "COMPLETED" },
  { id: "apt-2", date: new Date("2024-11-15"), service: "Volume Fill (2 weeks)", tech: "Katie M.", location: "Irvine", status: "COMPLETED" },
  { id: "apt-3", date: new Date("2024-10-10"), service: "Natural Wet Set", tech: "Sarah J.", location: "Irvine", status: "COMPLETED" },
];

// ============================================================================
// Mock API Functions (will be replaced with real API calls)
// ============================================================================

// Simulates network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory store for mock data
let clientsStore = [...mockClientsData];

async function fetchClients(params: {
  page: number;
  pageSize: number;
  search?: string;
  filter?: string;
}): Promise<{ clients: Client[]; total: number }> {
  await delay(300); // Simulate network

  let filtered = [...clientsStore];

  // Apply search
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone.includes(params.search!.replace(/\D/g, "")) ||
        c.email?.toLowerCase().includes(q)
    );
  }

  // Apply filter
  if (params.filter && params.filter !== "all") {
    filtered = filtered.filter((c) => {
      if (params.filter === "active") return !c.isBlocked && c.phoneVerified;
      if (params.filter === "blocked") return c.isBlocked;
      if (params.filter === "unverified") return !c.phoneVerified;
      return true;
    });
  }

  const total = filtered.length;
  const start = (params.page - 1) * params.pageSize;
  const clients = filtered.slice(start, start + params.pageSize);

  return { clients, total };
}

async function updateClient(
  id: string,
  data: Partial<Client>,
  expectedUpdatedAt: Date
): Promise<{ client: Client; conflict: boolean }> {
  await delay(400); // Simulate network

  const index = clientsStore.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error("Client not found");
  }

  const current = clientsStore[index];

  // Check for conflict (optimistic locking)
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return { client: current, conflict: true };
  }

  // Update the client
  const updated: Client = {
    ...current,
    ...data,
    updatedAt: new Date(),
  };

  clientsStore[index] = updated;
  return { client: updated, conflict: false };
}

// ============================================================================
// Component
// ============================================================================

export default function ClientsPage() {
  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [blockReason, setBlockReason] = useState("");

  // For debouncing search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track the request ID to handle race conditions
  const fetchRequestId = useRef(0);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const loadClients = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setIsLoading(true);

    try {
      const result = await fetchClients({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: searchQuery || undefined,
        filter: activeTab,
      });

      // Only update if this is still the latest request (prevents race conditions)
      if (requestId === fetchRequestId.current) {
        setClients(result.clients);
        setPagination((prev) => ({ ...prev, total: result.total }));
      }
    } catch (error) {
      if (requestId === fetchRequestId.current) {
        toast.error("Failed to load clients");
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [pagination.page, pagination.pageSize, searchQuery, activeTab]);

  // Load clients on mount and when dependencies change
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on search
    }, 300);
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  };

  const formatPhoneInput = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 10);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: string) => {
    setPagination((prev) => ({ ...prev, pageSize: parseInt(newSize), page: 1 }));
  };

  const handleRowClick = (client: Client) => {
    setSelectedClient(client);
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email || "",
      notes: client.notes || "",
    });
    setBlockReason(client.blockReason || "");
    setIsEditing(false);
    setIsDetailsOpen(true);
  };

  const handleStartEdit = () => {
    if (!selectedClient) return;
    setEditForm({
      firstName: selectedClient.firstName,
      lastName: selectedClient.lastName,
      phone: selectedClient.phone,
      email: selectedClient.email || "",
      notes: selectedClient.notes || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedClient) return;
    setEditForm({
      firstName: selectedClient.firstName,
      lastName: selectedClient.lastName,
      phone: selectedClient.phone,
      email: selectedClient.email || "",
      notes: selectedClient.notes || "",
    });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedClient || isSaving) return;

    // Validate
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.phone.trim()) {
      toast.error("First name, last name, and phone are required");
      return;
    }

    if (editForm.phone.length !== 10) {
      toast.error("Phone number must be 10 digits");
      return;
    }

    setIsSaving(true);

    // Optimistic update
    const optimisticClient: Client = {
      ...selectedClient,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      phone: editForm.phone,
      email: editForm.email.trim() || null,
      notes: editForm.notes.trim() || null,
    };

    // Store previous state for rollback
    const previousClient = selectedClient;
    const previousClients = [...clients];

    // Apply optimistic update to UI
    setSelectedClient(optimisticClient);
    setClients((prev) =>
      prev.map((c) => (c.id === selectedClient.id ? optimisticClient : c))
    );
    setIsEditing(false);

    try {
      const result = await updateClient(
        selectedClient.id,
        {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          phone: editForm.phone,
          email: editForm.email.trim() || null,
          notes: editForm.notes.trim() || null,
        },
        selectedClient.updatedAt
      );

      if (result.conflict) {
        // Conflict detected - rollback and show server state
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.client : c))
        );
        setSelectedClient(result.client);
        setEditForm({
          firstName: result.client.firstName,
          lastName: result.client.lastName,
          phone: result.client.phone,
          email: result.client.email || "",
          notes: result.client.notes || "",
        });
        toast.error("This client was modified by someone else. Please review and try again.");
        setIsEditing(true);
      } else {
        // Success - update with server response (includes new updatedAt)
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.client : c))
        );
        setSelectedClient(result.client);
        toast.success("Client updated");
      }
    } catch (error) {
      // Rollback on error
      setClients(previousClients);
      setSelectedClient(previousClient);
      setIsEditing(true);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedClient || isSaving) return;

    const newBlockedStatus = !selectedClient.isBlocked;

    if (newBlockedStatus && !blockReason.trim()) {
      toast.error("Please provide a reason for blocking");
      return;
    }

    setIsSaving(true);

    // Optimistic update
    const optimisticClient: Client = {
      ...selectedClient,
      isBlocked: newBlockedStatus,
      blockReason: newBlockedStatus ? blockReason : null,
    };

    const previousClient = selectedClient;
    const previousClients = [...clients];

    setSelectedClient(optimisticClient);
    setClients((prev) =>
      prev.map((c) => (c.id === selectedClient.id ? optimisticClient : c))
    );

    try {
      const result = await updateClient(
        selectedClient.id,
        {
          isBlocked: newBlockedStatus,
          blockReason: newBlockedStatus ? blockReason : null,
        },
        selectedClient.updatedAt
      );

      if (result.conflict) {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.client : c))
        );
        setSelectedClient(result.client);
        toast.error("This client was modified by someone else. Please refresh and try again.");
      } else {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.client : c))
        );
        setSelectedClient(result.client);
        toast.success(newBlockedStatus ? `${selectedClient.firstName} has been blocked` : `${selectedClient.firstName} has been unblocked`);
        if (!newBlockedStatus) setBlockReason("");
      }
    } catch (error) {
      setClients(previousClients);
      setSelectedClient(previousClient);
      toast.error("Failed to update client");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (client: Client) => {
    if (client.isBlocked) {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    if (!client.phoneVerified) {
      return <Badge variant="secondary">Unverified</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>;
  };

  // ============================================================================
  // Pagination helpers
  // ============================================================================

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const startItem = (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);

  // Stats (derived from total, not current page)
  const stats = {
    total: pagination.total,
    // These would come from the API in a real implementation
    active: clients.filter((c) => !c.isBlocked && c.phoneVerified).length,
    blocked: clients.filter((c) => c.isBlocked).length,
    unverified: clients.filter((c) => !c.phoneVerified).length,
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage your client database
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unverified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.unverified}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
            <TabsTrigger value="unverified">Unverified</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Client Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No clients found
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow
                    key={client.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${client.isBlocked ? "opacity-60" : ""}`}
                    onClick={() => handleRowClick(client)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        {client.notes && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              {client.notes}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {formatPhone(client.phone)}
                        {client.phoneVerified ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.lastVisitAt
                        ? formatDistanceToNow(client.lastVisitAt, { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{client.totalAppointments}</span>
                      {client.noShows > 0 && (
                        <span className="text-xs text-destructive ml-1.5">({client.noShows} no-show)</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(client)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!isLoading && pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {startItem}-{endItem} of {pagination.total}
                </span>
                <Select value={pagination.pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {pagination.page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
        if (isSaving) return; // Prevent closing while saving
        setIsDetailsOpen(open);
        if (!open) setIsEditing(false);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                {isEditing ? (
                  <DialogTitle className="text-xl">Edit Client</DialogTitle>
                ) : (
                  <>
                    <DialogTitle className="text-xl">
                      {selectedClient?.firstName} {selectedClient?.lastName}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Client since {selectedClient?.createdAt && format(selectedClient.createdAt, "MMM yyyy")}
                    </p>
                  </>
                )}
              </div>
              {!isEditing && selectedClient && (
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedClient)}
                  <Button variant="ghost" size="icon" onClick={handleStartEdit} disabled={isSaving}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-5">
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-sm">First Name</Label>
                      <Input
                        id="firstName"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        placeholder="First name"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                      <Input
                        id="lastName"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        placeholder="Last name"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm">Phone</Label>
                    <Input
                      id="phone"
                      value={formatPhone(editForm.phone)}
                      onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneInput(e.target.value) })}
                      placeholder="(555) 555-5555"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="email@example.com"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-sm">Notes</Label>
                    <Textarea
                      id="notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Allergies, preferences, special requests..."
                      rows={3}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  {/* Contact */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPhone(selectedClient.phone)}</span>
                      {selectedClient.phoneVerified && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      )}
                    </div>
                    {selectedClient.email && (
                      <span className="text-muted-foreground">{selectedClient.email}</span>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-semibold">{selectedClient.totalAppointments}</div>
                      <div className="text-xs text-muted-foreground">Visits</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-semibold text-destructive">{selectedClient.noShows}</div>
                      <div className="text-xs text-muted-foreground">No-shows</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-semibold">{selectedClient.cancellations}</div>
                      <div className="text-xs text-muted-foreground">Cancelled</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-semibold">
                        {selectedClient.lastVisitAt
                          ? formatDistanceToNow(selectedClient.lastVisitAt).replace(" ago", "").replace("about ", "")
                          : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Last visit</div>
                    </div>
                  </div>

                  {/* Block Status */}
                  {selectedClient.isBlocked && selectedClient.blockReason && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                      <Ban className="h-4 w-4 text-destructive mt-0.5" />
                      <span>{selectedClient.blockReason}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedClient.notes && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Notes</Label>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {selectedClient.notes}
                      </p>
                    </div>
                  )}

                  {/* Recent Appointments */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Recent Appointments</Label>
                    <div className="space-y-2">
                      {mockAppointments.slice(0, 3).map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <div className="text-sm font-medium">{apt.service}</div>
                            <div className="text-xs text-muted-foreground">
                              {apt.tech} · {apt.location}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(apt.date, "MMM d, yyyy")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Block/Unblock Section */}
                  {!selectedClient.isBlocked ? (
                    <div className="pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-destructive">Block Client</Label>
                        <Textarea
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                          placeholder="Reason for blocking..."
                          rows={2}
                          className="text-sm"
                          disabled={isSaving}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleToggleBlock}
                          disabled={!blockReason.trim() || isSaving}
                        >
                          {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                          <Ban className="h-3.5 w-3.5 mr-1.5" />
                          Block Client
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={handleToggleBlock} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Unblock Client
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
