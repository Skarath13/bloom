"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, parse } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, User, Shield, Lock, ChevronDown, CheckCircle } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { useBooking } from "@/components/booking/booking-context";
import { CardPaymentForm } from "@/components/booking/card-payment-form";
import { getStripe } from "@/lib/stripe-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ locationSlug: string; serviceId: string; technicianId: string }>;
}

interface BookingData {
  appointmentId: string;
  clientId: string;
  clientSecret: string;
  appointment: {
    service: { name: string; durationMinutes: number; price: number };
    location: { name: string };
    technician: { firstName: string; lastName: string };
  };
}

export default function CheckoutPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setClientInfo, state: bookingState, resetBooking } = useBooking();
  const [paramsData, setParamsData] = useState<{
    locationSlug: string;
    serviceId: string;
    technicianId: string;
  } | null>(null);

  const [step, setStep] = useState<"info" | "payment">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [formData, setFormData] = useState({
    firstName: bookingState.clientFirstName || "",
    lastName: bookingState.clientLastName || "",
    phone: bookingState.clientPhone || "",
    email: bookingState.clientEmail || "",
    notes: bookingState.notes || "",
  });

  const [locationId, setLocationId] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(setParamsData);
  }, [params]);

  // Restore form data from booking state on mount
  useEffect(() => {
    if (bookingState.clientFirstName) {
      setFormData({
        firstName: bookingState.clientFirstName,
        lastName: bookingState.clientLastName,
        phone: bookingState.clientPhone,
        email: bookingState.clientEmail,
        notes: bookingState.notes,
      });
    }
  }, [bookingState]);

  // Fetch location ID by slug
  useEffect(() => {
    if (!paramsData) return;

    const fetchLocation = async () => {
      try {
        const res = await fetch("/api/locations");
        const { locations } = await res.json();
        const location = locations?.find((l: { slug: string; id: string }) => l.slug === paramsData.locationSlug);
        if (location) {
          setLocationId(location.id);
        }
      } catch (error) {
        console.error("Failed to fetch location:", error);
      }
    };

    fetchLocation();
  }, [paramsData]);

  const dateStr = searchParams.get("date");
  const timeStr = searchParams.get("time");
  const appointmentDate = dateStr ? parse(dateStr, "yyyy-MM-dd", new Date()) : new Date();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 10) value = value.slice(0, 10);

    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }

    setFormData((prev) => ({ ...prev, phone: value }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error("Please enter your first name");
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error("Please enter your last name");
      return false;
    }
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return false;
    }
    return true;
  };

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !paramsData || !dateStr || !timeStr || !locationId) {
      if (!locationId) {
        toast.error("Loading location data, please try again...");
      }
      return;
    }

    // Save to booking context
    setClientInfo(formData.firstName, formData.lastName, formData.phone, formData.email, formData.notes);

    setIsLoading(true);

    try {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const startTime = new Date(appointmentDate);
      startTime.setHours(hours, minutes, 0, 0);

      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: locationId,
          serviceId: paramsData.serviceId,
          technicianId: paramsData.technicianId === "any" ? null : paramsData.technicianId,
          startTime: startTime.toISOString(),
          clientFirstName: formData.firstName,
          clientLastName: formData.lastName,
          clientPhone: formData.phone,
          clientEmail: formData.email || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      setBookingData({
        appointmentId: data.appointmentId,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        appointment: data.appointment,
      });
      setStep("payment");
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentMethodId: string) => {
    if (!bookingData) return;

    try {
      const response = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: bookingData.appointmentId,
          clientId: bookingData.clientId,
          paymentMethodId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm booking");
      }

      // Clear booking state after successful booking
      resetBooking();

      toast.success("Booking confirmed!");
      router.push(`/book/confirmation?booking=${bookingData.appointmentId}`);
    } catch (error) {
      console.error("Confirmation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to confirm booking");
      setIsLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  if (!paramsData) {
    return (
      <BookingLayoutWrapper currentStep={5}>
        <div className="text-center py-12">Loading...</div>
      </BookingLayoutWrapper>
    );
  }

  // Guard against missing date/time params
  if (!dateStr || !timeStr) {
    return (
      <BookingLayoutWrapper currentStep={5}>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">Missing appointment date or time.</p>
          <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}/${paramsData.technicianId}`}>
            <Button variant="outline">Go Back to Select Time</Button>
          </Link>
        </div>
      </BookingLayoutWrapper>
    );
  }

  const displayData = bookingData?.appointment || {
    service: { name: bookingState.serviceName || "Service", durationMinutes: bookingState.serviceDuration || 0, price: bookingState.servicePrice || 0 },
    location: { name: bookingState.locationName || paramsData.locationSlug },
    technician: { firstName: paramsData.technicianId === "any" ? "Any" : (bookingState.technicianName?.split(" ")[0] || ""), lastName: paramsData.technicianId === "any" ? "Available" : (bookingState.technicianName?.split(" ")[1] || "") },
  };

  return (
    <BookingLayoutWrapper currentStep={5}>
      <div className="space-y-4">
        {/* Back button */}
        <div>
          {step === "info" ? (
            <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}/${paramsData.technicianId}`}>
              <Button variant="ghost" size="sm" className="-ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("info")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Edit Info
            </Button>
          )}
        </div>

        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {step === "info" ? "Almost Done!" : "Save Your Card"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "info"
              ? "Enter your details to complete booking"
              : "Card saved for no-show protection only"}
          </p>
        </div>

        {/* Mobile: Collapsible Summary */}
        <div className="lg:hidden">
          <Collapsible open={showSummary} onOpenChange={setShowSummary}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Booking Summary</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${Number(displayData.service.price).toFixed(0)}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", showSummary && "rotate-180")} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span>{displayData.service.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span>{displayData.location.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date & Time</span>
                    <span>{format(appointmentDate, "MMM d")} at {timeStr}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium text-green-700">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Due Today
                    </span>
                    <span>$0.00</span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Desktop: Full Summary Sidebar */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
          <Card className="lg:col-span-1 h-fit lg:sticky lg:top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{displayData.location.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{format(appointmentDate, "EEE, MMM d")} at {timeStr}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{displayData.technician.firstName} {displayData.technician.lastName}</p>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Service Price</span>
                <span>${Number(displayData.service.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-green-700">
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Due Today
                </span>
                <span>$0.00</span>
              </div>
            </CardContent>
          </Card>

          {/* Form placeholder for grid */}
          <div className="lg:col-span-2" />
        </div>

        {/* Form / Payment - Full width on mobile */}
        <Card>
          {step === "info" ? (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Information</CardTitle>
                <CardDescription className="text-xs">
                  We&apos;ll send appointment reminders to your phone
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Almost Done Encouragement */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    You&apos;re almost done! Just add your details.
                  </p>
                </div>

                <form onSubmit={handleSubmitInfo} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="firstName" className="text-xs">First Name *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        placeholder="Jane"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                        className="h-12 text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs">Phone Number *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="(555) 555-5555"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      For appointment reminders
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs">Email (Optional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">Special Requests (Optional)</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Allergies, preferences..."
                      value={formData.notes}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      rows={2}
                      className="text-base"
                    />
                  </div>

                  {/* Trust indicators */}
                  <div className="flex items-center justify-center gap-4 py-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      Secure
                    </span>
                    <span className="flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      256-bit SSL
                    </span>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                    {isLoading ? "Processing..." : "Continue to Card"}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Card on File</CardTitle>
                <CardDescription className="text-xs">
                  Saved for no-show protection only - not charged today
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Reassurance */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    Your card will NOT be charged today
                  </p>
                  <p className="text-xs text-blue-700">
                    We only save it for no-show protection. Pay in-store after your service.
                  </p>
                </div>

                {bookingData?.clientSecret && (
                  <Elements
                    stripe={getStripe()}
                    options={{
                      clientSecret: bookingData.clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#1A1A1A",
                          borderRadius: "8px",
                        },
                      },
                    }}
                  >
                    <CardPaymentForm
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      isProcessing={isLoading}
                      setIsProcessing={setIsLoading}
                    />
                  </Elements>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </BookingLayoutWrapper>
  );
}
