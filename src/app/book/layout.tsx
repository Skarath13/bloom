import { ReactNode } from "react";
import { BookingProvider } from "@/components/booking/booking-context";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-brand-gradient">
        {children}
      </div>
    </BookingProvider>
  );
}
