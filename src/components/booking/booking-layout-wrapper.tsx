"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { BookingSteps } from "./booking-steps";
import { useBooking } from "./booking-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleStartOver = () => {
    resetBooking();
    router.push("/book");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Start Over Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current booking selections and take you back to the beginning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartOver}>Yes, start over</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <div className="max-w-2xl mx-auto px-4 py-2">
          <BookingSteps currentStep={currentStep} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {children}
      </main>

      {/* Footer */}
      {showFooter && (
        <footer className="py-4 text-center border-t bg-card/50 safe-area-inset-bottom">
          <p className="text-xs text-muted-foreground">Questions? Text us at 657-334-9919</p>
          <button
            onClick={() => setShowConfirmDialog(true)}
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
