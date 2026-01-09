"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "@/components/providers/session-provider";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { MobileBottomNav, MobileMoreSheet } from "@/components/calendar/mobile";
import { MobileNavProvider } from "@/contexts/mobile-nav-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Full-bleed pages (no padding, handle their own layout)
  const isFullBleedPage = pathname === "/admin/calendar" || pathname === "/admin/services";

  return (
    <SessionProvider>
      <MobileNavProvider>
        <div className="flex h-screen overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <AdminSidebar />
          </div>

          {/* Mobile sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-56">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
              </VisuallyHidden>
              <AdminSidebar />
            </SheetContent>
          </Sheet>

          {/* Main content - no header, full height */}
          <div className="flex flex-1 flex-col min-h-0 relative">
            {/* Mobile menu button - floating (hidden on mobile since we have bottom nav) */}
            {!isMobile && !isFullBleedPage && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden absolute top-2 left-2 z-50 bg-white/80 backdrop-blur-sm shadow-sm"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            )}
            <main className={`flex-1 bg-background relative ${isFullBleedPage ? "overflow-hidden" : "overflow-auto p-6"} ${isMobile && !isFullBleedPage ? "pb-24" : ""}`}>
              {children}
            </main>
          </div>

          {/* Mobile bottom navigation - persistent across all admin pages */}
          {isMobile && (
            <>
              <MobileBottomNav onMoreClick={() => setMoreSheetOpen(true)} />
              <MobileMoreSheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen} />
            </>
          )}
        </div>
      </MobileNavProvider>
    </SessionProvider>
  );
}
