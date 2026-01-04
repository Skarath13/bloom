"use client";

import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { CreditCard, Lock, Shield } from "lucide-react";

interface CardPaymentFormProps {
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export function CardPaymentForm({
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}: CardPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Confirm the Setup Intent
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href, // Fallback, won't be used with redirect: "if_required"
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An error occurred");
      onError(error.message || "An error occurred");
      setIsProcessing(false);
    } else if (setupIntent && setupIntent.status === "succeeded") {
      // Get the payment method ID from the setup intent
      const paymentMethodId = setupIntent.payment_method as string;
      onSuccess(paymentMethodId);
    } else {
      setErrorMessage("Something went wrong. Please try again.");
      onError("Setup failed");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4 bg-white">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Security notice */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-2">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium">Card-on-File Protection</h4>
            <p className="text-muted-foreground mt-1">
              Your card will be securely saved but <strong>not charged now</strong>.
              A fee may only be charged if you no-show or cancel within 6 hours
              of your appointment.
            </p>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          "Processing..."
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Save Card & Confirm Booking
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Secure payment powered by Stripe</span>
      </div>
    </form>
  );
}
