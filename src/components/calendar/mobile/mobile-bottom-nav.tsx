"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users, Eye, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/contexts/mobile-nav-context";

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

const navItems = [
  { name: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { name: "Clients", href: "/admin/clients", icon: Users },
  { name: "Services", href: "/admin/services", icon: Eye },
];

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { isNavHidden } = useMobileNav();

  if (isNavHidden) return null;

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-3 py-1.5 rounded-lg transition-colors",
                "active:bg-gray-100",
                isActive
                  ? "text-blue-600"
                  : "text-gray-500"
              )}
            >
              <item.icon className={cn(
                "h-6 w-6",
                isActive && "stroke-[2.5px]"
              )} />
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "font-semibold"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* More button - opens sheet instead of navigating */}
        <button
          onClick={onMoreClick}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-3 py-1.5 rounded-lg transition-colors",
            "active:bg-gray-100 text-gray-500"
          )}
        >
          <Menu className="h-6 w-6" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
