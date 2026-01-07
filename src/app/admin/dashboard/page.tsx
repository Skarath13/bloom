"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, DollarSign, Clock, Loader2 } from "lucide-react";
import { supabase, tables } from "@/lib/supabase";
import { format, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";

interface DashboardStats {
  todayAppointments: number;
  pendingConfirmation: number;
  totalClients: number;
  newClientsThisMonth: number;
  todayDeposits: number;
  recentAppointments: Array<{
    id: string;
    clientName: string;
    serviceName: string;
    startTime: string;
    status: string;
  }>;
  todaySchedule: Array<{
    id: string;
    clientName: string;
    technicianName: string;
    serviceName: string;
    startTime: string;
    status: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const todayEnd = endOfDay(today).toISOString();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

        // Fetch all data in parallel
        const [
          todayAppointmentsRes,
          pendingRes,
          totalClientsRes,
          newClientsRes,
          todayDepositsRes,
          recentAppointmentsRes,
          todayScheduleRes,
        ] = await Promise.all([
          // Today's appointments count
          supabase
            .from(tables.appointments)
            .select("id", { count: "exact", head: true })
            .gte("startTime", todayStart)
            .lte("startTime", todayEnd),

          // Pending confirmation count (today)
          supabase
            .from(tables.appointments)
            .select("id", { count: "exact", head: true })
            .gte("startTime", todayStart)
            .lte("startTime", todayEnd)
            .eq("status", "pending"),

          // Total clients
          supabase
            .from(tables.clients)
            .select("id", { count: "exact", head: true })
            .eq("isBlocked", false),

          // New clients this month
          supabase
            .from(tables.clients)
            .select("id", { count: "exact", head: true })
            .gte("createdAt", monthStart),

          // Today's deposits (from confirmed appointments)
          supabase
            .from(tables.appointments)
            .select("depositAmount")
            .gte("startTime", todayStart)
            .lte("startTime", todayEnd)
            .not("depositPaidAt", "is", null),

          // Recent appointments (last 5)
          supabase
            .from(tables.appointments)
            .select(`
              id,
              startTime,
              status,
              bloom_clients!inner(firstName, lastName),
              bloom_services!inner(name)
            `)
            .order("createdAt", { ascending: false })
            .limit(5),

          // Today's schedule
          supabase
            .from(tables.appointments)
            .select(`
              id,
              startTime,
              status,
              bloom_clients!inner(firstName, lastName),
              bloom_technicians!inner(firstName, lastName),
              bloom_services!inner(name)
            `)
            .gte("startTime", todayStart)
            .lte("startTime", todayEnd)
            .order("startTime", { ascending: true })
            .limit(10),
        ]);

        // Calculate today's deposits total
        const depositsTotal = todayDepositsRes.data?.reduce(
          (sum, apt) => sum + (apt.depositAmount || 0),
          0
        ) || 0;

        // Transform recent appointments
        const recentAppointments = (recentAppointmentsRes.data || []).map((apt: Record<string, unknown>) => {
          const client = apt.bloom_clients as { firstName: string; lastName: string } | null;
          const service = apt.bloom_services as { name: string } | null;
          return {
            id: apt.id as string,
            clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown",
            serviceName: service?.name || "Unknown",
            startTime: apt.startTime as string,
            status: apt.status as string,
          };
        });

        // Transform today's schedule
        const todaySchedule = (todayScheduleRes.data || []).map((apt: Record<string, unknown>) => {
          const client = apt.bloom_clients as { firstName: string; lastName: string } | null;
          const tech = apt.bloom_technicians as { firstName: string; lastName: string } | null;
          const service = apt.bloom_services as { name: string } | null;
          return {
            id: apt.id as string,
            clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown",
            technicianName: tech ? `${tech.firstName} ${tech.lastName}` : "Unknown",
            serviceName: service?.name || "Unknown",
            startTime: apt.startTime as string,
            status: apt.status as string,
          };
        });

        setStats({
          todayAppointments: todayAppointmentsRes.count || 0,
          pendingConfirmation: pendingRes.count || 0,
          totalClients: totalClientsRes.count || 0,
          newClientsThisMonth: newClientsRes.count || 0,
          todayDeposits: depositsTotal,
          recentAppointments,
          todaySchedule,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statsCards = [
    {
      title: "Today's Appointments",
      value: stats?.todayAppointments.toString() || "0",
      description: `${stats?.pendingConfirmation || 0} pending confirmation`,
      icon: CalendarDays,
    },
    {
      title: "Total Clients",
      value: stats?.totalClients.toLocaleString() || "0",
      description: "Active clients",
      icon: Users,
      trend: `+${stats?.newClientsThisMonth || 0} this month`,
    },
    {
      title: "Today's Deposits",
      value: `$${stats?.todayDeposits.toFixed(2) || "0.00"}`,
      description: "From bookings",
      icon: DollarSign,
    },
    {
      title: "Avg. Wait Time",
      value: "N/A",
      description: "Check-in not enabled",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.trend && (
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
            <CardDescription>Latest bookings across all locations</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentAppointments.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No recent appointments.
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.recentAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{apt.clientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.serviceName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.startTime), "MMM d, h:mm a")}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        apt.status === "confirmed" ? "bg-green-100 text-green-700" :
                        apt.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <CardDescription>Quick view of today&apos;s appointments</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.todaySchedule.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No appointments scheduled for today.
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.todaySchedule.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{apt.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {apt.technicianName} - {apt.serviceName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {format(new Date(apt.startTime), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/calendar"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              Open Calendar
            </Link>
            <Link
              href="/admin/clients"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              Manage Clients
            </Link>
            <Link
              href="/admin/services"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              View Services
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
