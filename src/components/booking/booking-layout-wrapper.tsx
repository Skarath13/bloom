"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { BookingSteps } from "./booking-steps";
import { useBooking } from "./booking-context";

interface BookingLayoutWrapperProps {
  children: ReactNode;
  currentStep: number;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function BookingLayoutWrapper({
  children,
  currentStep,
  showHeader = true,
  showFooter = true,
}: BookingLayoutWrapperProps) {
  const { resetBooking } = useBooking();
  const router = useRouter();

  const handleStartOver = () => {
    resetBooking();
    router.push("/book");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {showHeader && (
        <header className="py-3 text-center border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50 safe-area-inset-top">
          <Link href="/book" className="inline-block">
            <div className="w-64 h-14 mx-auto overflow-hidden">
              <img
                src="/logo.webp"
                alt="Elegant Lashes by Katie"
                className="w-full h-full object-contain scale-150"
              />
            </div>
          </Link>
        </header>
      )}

      {/* Progress Steps - Mobile optimized */}
      <div className="bg-card/50 border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <BookingSteps currentStep={currentStep} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      {showFooter && (
        <footer className="py-4 text-center border-t bg-card/50 safe-area-inset-bottom">
          <p className="text-xs text-muted-foreground">Questions? Text us at 657-334-9919</p>
          <button
            onClick={handleStartOver}
            className="mt-2 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Start over
          </button>
        </footer>
      )}
    </div>
  );
}
