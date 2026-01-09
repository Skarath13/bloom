"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  CalendarDays,
  Users,
  MapPin,
  LayoutDashboard,
  Settings,
  LogOut,
  UserCircle,
  ClipboardList,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { name: "Appointments", href: "/admin/appointments", icon: ClipboardList },
  { name: "Clients", href: "/admin/clients", icon: Users },
  { name: "Technicians", href: "/admin/technicians", icon: UserCircle },
  { name: "Services", href: "/admin/services", icon: Sparkles },
  { name: "Locations", href: "/admin/locations", icon: MapPin },
];

const secondaryNavigation = [
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const handleNavigation = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/admin/login" });
  };

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-none p-0 flex flex-col [&>button]:hidden"
        style={{ height: "100dvh" }}
      >
        {/* Accessibility (visually hidden) */}
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Navigation menu with links to all admin sections
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold pr-10">
            Menu
          </h1>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors",
                    "active:bg-gray-100",
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-700"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left font-medium">{item.name}</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              );
            })}
          </div>

          <Separator className="my-2" />

          <div className="py-2">
            {secondaryNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors",
                    "active:bg-gray-100",
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-700"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left font-medium">{item.name}</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>

        {/* User section at bottom */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0 safe-area-inset-bottom">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gray-200 text-gray-700">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
