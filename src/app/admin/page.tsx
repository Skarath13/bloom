import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, DollarSign, Clock } from "lucide-react";

// Stats cards data (will be dynamic later)
const stats = [
  {
    title: "Today's Appointments",
    value: "12",
    description: "3 pending confirmation",
    icon: CalendarDays,
    trend: "+2 from yesterday",
  },
  {
    title: "Total Clients",
    value: "1,234",
    description: "Active clients",
    icon: Users,
    trend: "+18 this month",
  },
  {
    title: "Today's Revenue",
    value: "$850",
    description: "From deposits",
    icon: DollarSign,
    trend: "+12% from last week",
  },
  {
    title: "Avg. Wait Time",
    value: "0 min",
    description: "No clients waiting",
    icon: Clock,
    trend: "On schedule",
  },
];

export default function AdminDashboard() {
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
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
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
            <div className="text-sm text-muted-foreground">
              No appointments yet. Connect your database to see live data.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <CardDescription>Quick view of today&apos;s appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Connect to your database to view today&apos;s schedule.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/calendar"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              Open Calendar
            </a>
            <a
              href="/admin/clients"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              Manage Clients
            </a>
            <a
              href="/admin/services"
              className="block p-2 rounded-lg hover:bg-muted text-sm"
            >
              View Services
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
