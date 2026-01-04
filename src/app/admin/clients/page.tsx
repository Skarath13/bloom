"use client";

import { useState } from "react";
import { Search, Phone, Mail, Calendar, AlertTriangle, CheckCircle, Ban, Eye, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

// Mock clients
const initialClients = [
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
  },
];

// Mock appointment history
const mockAppointments = [
  { id: "apt-1", date: new Date("2024-12-20"), service: "Elegant Volume Set", tech: "Katie M.", location: "Irvine", status: "COMPLETED" },
  { id: "apt-2", date: new Date("2024-11-15"), service: "Volume Fill (2 weeks)", tech: "Katie M.", location: "Irvine", status: "COMPLETED" },
  { id: "apt-3", date: new Date("2024-10-10"), service: "Natural Wet Set", tech: "Sarah J.", location: "Irvine", status: "COMPLETED" },
];

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
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      searchQuery === "" ||
      `${client.firstName} ${client.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery.replace(/\D/g, "")) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && !client.isBlocked) ||
      (activeTab === "blocked" && client.isBlocked) ||
      (activeTab === "unverified" && !client.phoneVerified);

    return matchesSearch && matchesTab;
  });

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setIsDetailsOpen(true);
  };

  const handleBlockClient = (client: Client) => {
    setSelectedClient(client);
    setBlockReason(client.blockReason || "");
    setIsBlockDialogOpen(true);
  };

  const handleEditNotes = (client: Client) => {
    setSelectedClient(client);
    setEditNotes(client.notes || "");
    setIsNotesDialogOpen(true);
  };

  const confirmBlock = () => {
    if (!selectedClient) return;

    setClients((prev) =>
      prev.map((c) =>
        c.id === selectedClient.id
          ? { ...c, isBlocked: !c.isBlocked, blockReason: c.isBlocked ? null : blockReason }
          : c
      )
    );

    toast.success(
      selectedClient.isBlocked
        ? `${selectedClient.firstName} has been unblocked`
        : `${selectedClient.firstName} has been blocked`
    );
    setIsBlockDialogOpen(false);
    setBlockReason("");
  };

  const saveNotes = () => {
    if (!selectedClient) return;

    setClients((prev) =>
      prev.map((c) =>
        c.id === selectedClient.id ? { ...c, notes: editNotes || null } : c
      )
    );

    toast.success("Notes saved");
    setIsNotesDialogOpen(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client database and history
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => !c.isBlocked && c.phoneVerified).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {clients.filter((c) => c.isBlocked).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unverified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => !c.phoneVerified).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Clients</CardTitle>
              <CardDescription>
                Search and manage client accounts
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="blocked">Blocked</TabsTrigger>
                <TabsTrigger value="unverified">Unverified</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No clients found
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} className={client.isBlocked ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-medium">
                        {client.firstName} {client.lastName}
                      </div>
                      {client.notes && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MessageSquare className="h-3 w-3" />
                          Has notes
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {formatPhone(client.phone)}
                          {client.phoneVerified ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.lastVisitAt ? (
                        <div className="text-sm">
                          <div>{format(client.lastVisitAt, "MMM d, yyyy")}</div>
                          <div className="text-muted-foreground text-xs">
                            {formatDistanceToNow(client.lastVisitAt, { addSuffix: true })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {client.totalAppointments} total
                        </div>
                        {(client.noShows > 0 || client.cancellations > 0) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {client.noShows > 0 && (
                              <span className="text-destructive">{client.noShows} no-shows</span>
                            )}
                            {client.noShows > 0 && client.cancellations > 0 && " · "}
                            {client.cancellations > 0 && (
                              <span>{client.cancellations} cancelled</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(client)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(client)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditNotes(client)}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Edit Notes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleBlockClient(client)}
                            className={client.isBlocked ? "text-green-600" : "text-destructive"}
                          >
                            {client.isBlocked ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Unblock Client
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                Block Client
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogTitle>
            <DialogDescription>
              Client since {selectedClient?.createdAt && format(selectedClient.createdAt, "MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <div className="flex items-center gap-2">
                    {formatPhone(selectedClient.phone)}
                    {selectedClient.phoneVerified ? (
                      <Badge variant="outline" className="text-green-600">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <div>{selectedClient.email || "Not provided"}</div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{selectedClient.totalAppointments}</div>
                  <div className="text-xs text-muted-foreground">Total Visits</div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold text-destructive">{selectedClient.noShows}</div>
                  <div className="text-xs text-muted-foreground">No-Shows</div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{selectedClient.cancellations}</div>
                  <div className="text-xs text-muted-foreground">Cancellations</div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">
                    {selectedClient.lastVisitAt
                      ? formatDistanceToNow(selectedClient.lastVisitAt, { addSuffix: false })
                      : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground">Since Last Visit</div>
                </div>
              </div>

              {/* Notes */}
              {selectedClient.notes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {selectedClient.notes}
                  </div>
                </div>
              )}

              {/* Block Status */}
              {selectedClient.isBlocked && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive font-medium">
                    <Ban className="h-4 w-4" />
                    Client is Blocked
                  </div>
                  {selectedClient.blockReason && (
                    <div className="text-sm mt-1 text-muted-foreground">
                      Reason: {selectedClient.blockReason}
                    </div>
                  )}
                </div>
              )}

              {/* Appointment History */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Recent Appointments</Label>
                <div className="border rounded-lg divide-y">
                  {mockAppointments.map((apt) => (
                    <div key={apt.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{apt.service}</div>
                        <div className="text-sm text-muted-foreground">
                          with {apt.tech} at {apt.location}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{format(apt.date, "MMM d, yyyy")}</div>
                        <Badge variant="outline" className="text-green-600">
                          {apt.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block/Unblock Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedClient?.isBlocked ? "Unblock" : "Block"} {selectedClient?.firstName}?
            </DialogTitle>
            <DialogDescription>
              {selectedClient?.isBlocked
                ? "This client will be able to book appointments again."
                : "This client will not be able to book any appointments."}
            </DialogDescription>
          </DialogHeader>

          {!selectedClient?.isBlocked && (
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason for blocking</Label>
              <Textarea
                id="blockReason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Multiple no-shows, inappropriate behavior..."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedClient?.isBlocked ? "default" : "destructive"}
              onClick={confirmBlock}
            >
              {selectedClient?.isBlocked ? "Unblock" : "Block"} Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Notes for {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogTitle>
            <DialogDescription>
              Add important notes about this client (allergies, preferences, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="e.g., Prefers natural look, sensitive eyes, allergic to certain adhesives..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNotes}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
