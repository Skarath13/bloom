"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, parse } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, User, ChevronDown, Shield, ImagePlus, X, Loader2 } from "lucide-react";
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
  const [inspoImage, setInspoImage] = useState<File | null>(null);
  const [inspoPreview, setInspoPreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    setInspoImage(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setInspoPreview(previewUrl);
  };

  const handleRemoveImage = () => {
    if (inspoPreview) {
      URL.revokeObjectURL(inspoPreview);
    }
    setInspoImage(null);
    setInspoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadInspoImage = async (): Promise<string | null> => {
    if (!inspoImage) return null;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", inspoImage);

      const response = await fetch("/api/upload/inspo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload image");
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload inspiration image");
      return null;
    } finally {
      setIsUploadingImage(false);
    }
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
      // Upload inspo image first if selected
      let inspoImageUrl: string | null = null;
      if (inspoImage) {
        inspoImageUrl = await uploadInspoImage();
      }

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
          inspoImageUrl: inspoImageUrl || undefined,
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
      <div className="space-y-3">
        {/* Back button + Header inline */}
        <div className="flex items-center gap-3 mb-1">
          {step === "info" ? (
            <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}/${paramsData.technicianId}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setStep("info")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {step === "info" ? "Almost Done!" : "Save Your Card"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {step === "info"
                ? "Enter your details to complete booking"
                : "Card saved for no-show protection only"}
            </p>
          </div>
        </div>

        {/* Mobile: Collapsible Summary */}
        <div className="lg:hidden">
          <Collapsible open={showSummary} onOpenChange={setShowSummary}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg cursor-pointer border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{displayData.service.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{format(appointmentDate, "MMM d")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">${Number(displayData.service.price).toFixed(0)}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showSummary && "rotate-180")} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5 py-2 px-3 bg-muted/30 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span>{displayData.location.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span>{timeStr}</span>
                </div>
                <div className="flex justify-between font-medium text-green-700 pt-1 border-t mt-1">
                  <span>Due Today</span>
                  <span>$0.00</span>
                </div>
              </div>
            </CollapsibleContent>
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
            <CardContent className="p-3">
              <form onSubmit={handleSubmitInfo} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="firstName" className="text-xs">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Jane"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs">Phone *</Label>
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
                    className="h-9 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs">Email (optional)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-9 mt-1"
                  />
                </div>

                {/* Inspo Image Upload - Mobile optimized */}
                <div>
                  <Label className="text-xs">Inspiration Photo (optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                  {inspoPreview ? (
                    <div className="mt-1 relative">
                      <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={inspoPreview}
                          alt="Inspiration preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        {isUploadingImage && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        This will be shared with your technician
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 w-full h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-xs">Tap to add photo</span>
                    </button>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Allergies, preferences..."
                    value={formData.notes}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    rows={2}
                    className="text-sm mt-1"
                  />
                </div>

                <Button type="submit" className="w-full h-10 mt-1" disabled={isLoading}>
                  {isLoading ? "Processing..." : "Continue to Card"}
                </Button>
              </form>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Card on File</CardTitle>
                <CardDescription className="text-xs">
                  Saved for no-show protection · Not charged today
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {/* Reassurance */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
                  <p className="text-xs text-blue-800 font-medium">
                    Your card will NOT be charged today
                  </p>
                  <p className="text-[10px] text-blue-700 mt-0.5">
                    Save for no-show protection. Pay in-store after service.
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
