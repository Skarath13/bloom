"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "@/components/providers/session-provider";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Calendar page gets full-bleed layout (no padding)
  const isCalendarPage = pathname === "/admin/calendar";

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <AdminSidebar />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-56">
            <AdminSidebar />
          </SheetContent>
        </Sheet>

        {/* Main content - no header, full height */}
        <div className="flex flex-1 flex-col min-h-0 relative">
          {/* Mobile menu button - floating */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden absolute top-2 left-2 z-50 bg-white/80 backdrop-blur-sm shadow-sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
          <main className={`flex-1 bg-background relative ${isCalendarPage ? "overflow-hidden" : "overflow-auto p-6"}`}>
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
