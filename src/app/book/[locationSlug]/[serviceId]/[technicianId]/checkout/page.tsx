"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, parse } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, Scissors, User, Shield } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BookingSteps } from "@/components/booking/booking-steps";
import { CardPaymentForm } from "@/components/booking/card-payment-form";
import { getStripe } from "@/lib/stripe-client";
import { toast } from "sonner";

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
  const [paramsData, setParamsData] = useState<{
    locationSlug: string;
    serviceId: string;
    technicianId: string;
  } | null>(null);

  const [step, setStep] = useState<"info" | "payment">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Resolve params
  useEffect(() => {
    params.then(setParamsData);
  }, [params]);

  const dateStr = searchParams.get("date");
  const timeStr = searchParams.get("time");
  const appointmentDate = dateStr ? parse(dateStr, "yyyy-MM-dd", new Date()) : new Date();

  // Get location ID from slug
  const locationMap: Record<string, string> = {
    irvine: "loc_irvine",
    tustin: "loc_tustin",
    "santa-ana": "loc_santa_ana",
    "costa-mesa": "loc_costa_mesa",
    "newport-beach": "loc_newport_beach",
  };

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

    if (!validateForm() || !paramsData || !dateStr || !timeStr) return;

    setIsLoading(true);

    try {
      // Parse the selected time and date to create appointment start time
      const [hours, minutes] = timeStr.split(":").map(Number);
      const startTime = new Date(appointmentDate);
      startTime.setHours(hours, minutes, 0, 0);

      // Create the booking and get Setup Intent
      const response = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: locationMap[paramsData.locationSlug] || paramsData.locationSlug,
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
      // Confirm the booking with the payment method
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
    return <div className="text-center py-12">Loading...</div>;
  }

  const displayData = bookingData?.appointment || {
    service: { name: "Service", durationMinutes: 0, price: 0 },
    location: { name: paramsData.locationSlug },
    technician: { firstName: paramsData.technicianId === "any" ? "Any" : "", lastName: paramsData.technicianId === "any" ? "Available" : "" },
  };

  return (
    <>
      <BookingSteps currentStep={5} />

      {/* Back button */}
      <div className="mb-6">
        {step === "info" ? (
          <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}/${paramsData.technicianId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Time
            </Button>
          </Link>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setStep("info")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Edit Information
          </Button>
        )}
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground">
          {step === "info" ? "Complete Your Booking" : "Save Card for No-Show Protection"}
        </h2>
        <p className="text-muted-foreground mt-1">
          {step === "info"
            ? "Enter your details to continue"
            : "Your card will be saved but not charged unless you no-show"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Booking Summary */}
        <Card className="lg:col-span-1 h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{displayData.location.name}</p>
                <p className="text-sm text-muted-foreground">Location</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Scissors className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{displayData.service.name}</p>
                <p className="text-sm text-muted-foreground">{displayData.service.durationMinutes} minutes</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {displayData.technician.firstName} {displayData.technician.lastName}
                </p>
                <p className="text-sm text-muted-foreground">Technician</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{format(appointmentDate, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-sm text-muted-foreground">Date</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{timeStr || "Time"}</p>
                <p className="text-sm text-muted-foreground">Time</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Service Price</span>
                <span>${Number(displayData.service.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Due at appointment</span>
                <span>${Number(displayData.service.price).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-green-700">
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Due Today
                </span>
                <span>$0.00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form / Payment */}
        <Card className="lg:col-span-2">
          {step === "info" ? (
            <>
              <CardHeader>
                <CardTitle>Your Information</CardTitle>
                <CardDescription>
                  We&apos;ll send appointment reminders to your phone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitInfo} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        placeholder="Enter your first name"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        placeholder="Enter your last name"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(555) 555-5555"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send SMS reminders 24 hours and 2 hours before your appointment
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Special Requests (Optional)</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Any allergies, preferences, or special requests..."
                      value={formData.notes}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      rows={3}
                    />
                  </div>

                  <Separator />

                  {/* Policy Notice */}
                  <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    <h4 className="font-medium mb-2">No-Show Protection Policy</h4>
                    <p className="text-muted-foreground">
                      A card is required to book but will <strong>not be charged</strong> unless
                      you no-show or cancel within 6 hours of your appointment. In that case,
                      a $25 fee may be charged.
                    </p>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? "Processing..." : "Continue to Card"}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Card on File</CardTitle>
                <CardDescription>
                  Your card is saved for no-show protection only
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bookingData?.clientSecret && (
                  <Elements
                    stripe={getStripe()}
                    options={{
                      clientSecret: bookingData.clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#1E1B4B",
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
    </>
  );
}
