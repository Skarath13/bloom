"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PhoneVerificationInput } from "@/components/booking/phone-verification-input";
import { ClientData } from "@/hooks/use-phone-verification";
import { getStoredClient, clearStoredClient } from "@/components/booking/grid-location-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  CreditCard,
  Calendar,
  Pencil,
  Check,
  X,
  Trash2,
  Loader2,
  ExternalLink,
  ChevronRight,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  inspoImageUrl: string | null;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
  } | null;
  technician: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
    address: string;
  } | null;
}

interface ProfileData {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    notes: string | null;
    createdAt: string;
  };
  paymentMethods: PaymentMethod[];
  appointments: Appointment[];
}

// Brand colors for cards
const brandConfig: Record<string, { color: string; name: string }> = {
  visa: { color: "#1A1F71", name: "Visa" },
  mastercard: { color: "#EB001B", name: "Mastercard" },
  amex: { color: "#006FCF", name: "Amex" },
  discover: { color: "#FF6000", name: "Discover" },
};

function getBrandInfo(brand: string) {
  const normalized = brand.toLowerCase().replace(/\s/g, "");
  return brandConfig[normalized] || { color: "#6B7280", name: brand };
}

function formatExpiry(month: number, year: number) {
  return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Status badge colors
const statusColors: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
};

export default function ProfilePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true to check localStorage first
  const [error, setError] = useState<string | null>(null);
  const [checkingStoredLogin, setCheckingStoredLogin] = useState(true);

  // Edit states
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Fetch profile data
  const fetchProfile = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        // If unauthorized, clear stored login and reset
        if (response.status === 401) {
          clearStoredClient();
          setIsVerified(false);
          setSessionToken(null);
          setIsLoading(false);
          setCheckingStoredLogin(false);
          return;
        }
        throw new Error(data.error || "Failed to fetch profile");
      }

      const data = await response.json();
      setProfileData(data);
      setEditForm({
        firstName: data.client.firstName || "",
        lastName: data.client.lastName || "",
        email: data.client.email || "",
        notes: data.client.notes || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disable Safari scroll restoration and scroll to top on mount
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, []);

  // Check for stored login on mount (skip SMS verification if already logged in)
  useEffect(() => {
    const storedClient = getStoredClient();
    if (storedClient && storedClient.sessionToken) {
      // Valid stored login exists - auto-login
      setIsVerified(true);
      setSessionToken(storedClient.sessionToken);
      setPhone(storedClient.phone);
      fetchProfile(storedClient.sessionToken);
    } else {
      setIsLoading(false);
    }
    setCheckingStoredLogin(false);
  }, [fetchProfile]);

  // Handle phone verification
  const handleVerified = useCallback(
    async (clientData: ClientData | null) => {
      setIsVerified(true);

      // Get the session token from the verification response
      // This is stored in sessionStorage by the hook after verification
      const response = await fetch("/api/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          code: "verified", // This won't actually work - we need to capture the token differently
        }),
      });

      // Actually, we need to capture the token from the verification hook
      // For now, let's check sessionStorage where the hook might store it
    },
    [phone]
  );

  // Since the verification hook doesn't expose the token directly,
  // we need to modify our approach - fetch profile data using phone verification
  // We'll create a custom verification flow for the profile page

  const handlePhoneVerified = useCallback(
    async (clientData: ClientData | null, token?: string) => {
      setIsVerified(true);
      if (token) {
        setSessionToken(token);
        fetchProfile(token);
      }
    },
    [fetchProfile]
  );

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!sessionToken) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      const data = await response.json();
      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              client: { ...prev.client, ...data.client },
            }
          : null
      );
      setIsEditingInfo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete payment method
  const handleDeleteCard = async (cardId: string) => {
    if (!sessionToken) return;

    setDeletingCardId(cardId);
    try {
      const response = await fetch(`/api/profile/payment-methods/${cardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete card");
      }

      // Remove card from local state
      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              paymentMethods: prev.paymentMethods.filter((pm) => pm.id !== cardId),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setDeletingCardId(null);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (profileData) {
      setEditForm({
        firstName: profileData.client.firstName || "",
        lastName: profileData.client.lastName || "",
        email: profileData.client.email || "",
        notes: profileData.client.notes || "",
      });
    }
    setIsEditingInfo(false);
  };

  // Logout handler
  const handleLogout = () => {
    clearStoredClient();
    setIsVerified(false);
    setSessionToken(null);
    setProfileData(null);
    setPhone("");
    router.push("/book");
  };

  // Separate upcoming and past appointments
  const now = new Date();
  const upcomingAppointments =
    profileData?.appointments.filter(
      (apt) => new Date(apt.startTime) >= now && apt.status !== "CANCELLED"
    ) || [];
  const pastAppointments =
    profileData?.appointments.filter(
      (apt) => new Date(apt.startTime) < now || apt.status === "CANCELLED"
    ) || [];

  // Show loading while checking stored login
  if (checkingStoredLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Phone verification gate
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-12">
          {/* Back button */}
          <button
            onClick={() => router.push("/book")}
            className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to booking
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
            <p className="text-gray-600 mt-2">
              Verify your phone number to access your profile
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <ProfilePhoneVerification
              phone={phone}
              setPhone={setPhone}
              onVerified={(token) => {
                setIsVerified(true);
                setSessionToken(token);
                fetchProfile(token);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Profile loaded
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/book")}
            className="flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to booking
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{profileData?.client.firstName ? `, ${profileData.client.firstName}` : ""}!
          </h1>
          <p className="text-gray-600">
            Manage your information and payment methods
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Personal Info Section */}
        <section className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Personal Information</h2>
            </div>
            {!isEditingInfo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingInfo(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>

          <div className="p-6">
            {isEditingInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={editForm.firstName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, firstName: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={editForm.lastName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, lastName: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Default Notes</Label>
                  <Textarea
                    id="notes"
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notes: e.target.value })
                    }
                    placeholder="Any preferences or notes for your appointments"
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium">
                    {profileData?.client.firstName} {profileData?.client.lastName}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium">{formatPhoneDisplay(profileData?.client.phone || "")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium">
                    {profileData?.client.email || (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </dd>
                </div>
                {profileData?.client.notes && (
                  <div>
                    <dt className="text-gray-500 mb-1">Notes</dt>
                    <dd className="text-sm bg-gray-50 p-2 rounded">
                      {profileData.client.notes}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </section>

        {/* Payment Methods Section */}
        <section className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Payment Methods</h2>
          </div>

          <div className="p-6">
            {profileData?.paymentMethods.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No saved payment methods
              </p>
            ) : (
              <div className="space-y-3">
                {profileData?.paymentMethods.map((card) => {
                  const brandInfo = getBrandInfo(card.brand);
                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-7 rounded flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: brandInfo.color }}
                        >
                          {brandInfo.name.slice(0, 4).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {brandInfo.name} ending in {card.last4}
                            {card.isDefault && (
                              <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expires {formatExpiry(card.expiryMonth, card.expiryYear)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deletingCardId === card.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deletingCardId === card.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Appointments Section */}
        <section className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Appointments</h2>
          </div>

          <div className="divide-y">
            {/* Upcoming */}
            {upcomingAppointments.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">
                  Upcoming
                </h3>
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {pastAppointments.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Past</h3>
                <div className="space-y-3">
                  {pastAppointments.slice(0, 10).map((apt) => (
                    <AppointmentCard key={apt.id} appointment={apt} isPast />
                  ))}
                </div>
              </div>
            )}

            {upcomingAppointments.length === 0 &&
              pastAppointments.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  No appointments yet
                </div>
              )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Appointment card component
function AppointmentCard({
  appointment,
  isPast = false,
}: {
  appointment: Appointment;
  isPast?: boolean;
}) {
  const statusColor = statusColors[appointment.status] || "bg-gray-100 text-gray-800";

  return (
    <div
      className={cn(
        "p-4 border rounded-lg",
        isPast && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{appointment.service?.name}</p>
          <p className="text-sm text-gray-600">
            {format(new Date(appointment.startTime), "EEEE, MMMM d, yyyy")}
          </p>
          <p className="text-sm text-gray-600">
            {format(new Date(appointment.startTime), "h:mm a")} -{" "}
            {format(new Date(appointment.endTime), "h:mm a")}
          </p>
          {appointment.technician && (
            <p className="text-sm text-gray-500 mt-1">
              with {appointment.technician.name}
            </p>
          )}
          {appointment.location && (
            <p className="text-sm text-gray-500">
              at {appointment.location.name}
            </p>
          )}
        </div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            statusColor
          )}
        >
          {appointment.status}
        </span>
      </div>
    </div>
  );
}

// Custom phone verification for profile page that captures the session token
function ProfilePhoneVerification({
  phone,
  setPhone,
  onVerified,
}: {
  phone: string;
  setPhone: (value: string) => void;
  onVerified: (token: string) => void;
}) {
  const [otpValue, setOtpValue] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "awaiting" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown effect
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const phoneDigits = phone.replace(/\D/g, "");
  const isValidPhone = phoneDigits.length === 10;

  const handleSendCode = async () => {
    if (!isValidPhone) return;

    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setError(data.error || "Failed to send code");
        return;
      }

      setStatus("awaiting");
      setShowOtp(true);
      setCanResend(false);
      setCountdown(60);
    } catch {
      setStatus("error");
      setError("Connection error");
    }
  };

  const handleVerify = async (code: string) => {
    setStatus("verifying");
    setError(null);

    try {
      const response = await fetch("/api/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("awaiting");
        setError(data.error || "Invalid code");
        setOtpValue("");
        return;
      }

      // Success - pass the session token
      if (data.sessionToken) {
        onVerified(data.sessionToken);
      }
    } catch {
      setStatus("error");
      setError("Connection error");
    }
  };

  // Auto-send when valid phone
  useEffect(() => {
    if (isValidPhone && status === "idle") {
      handleSendCode();
    }
  }, [isValidPhone]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="profile-phone">Phone Number</Label>
        <Input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          placeholder="(555) 555-5555"
          value={phone}
          onChange={(e) => {
            setPhone(formatPhone(e.target.value));
            if (showOtp) {
              setShowOtp(false);
              setStatus("idle");
              setOtpValue("");
            }
          }}
          className="mt-1 h-12 text-lg"
          disabled={status === "verifying"}
        />
      </div>

      {showOtp && (
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 text-center">
            Enter the 6-digit code sent to {phone}
          </p>

          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpValue[i] || ""}
                onChange={(e) => {
                  const digit = e.target.value.replace(/\D/g, "");
                  if (digit) {
                    const newOtp = otpValue.slice(0, i) + digit + otpValue.slice(i + 1);
                    setOtpValue(newOtp.slice(0, 6));
                    if (newOtp.length === 6) {
                      handleVerify(newOtp);
                    } else {
                      const next = e.target.nextElementSibling as HTMLInputElement;
                      next?.focus();
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otpValue[i]) {
                    const prev = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    prev?.focus();
                  }
                }}
                className={cn(
                  "w-12 h-14 text-center text-2xl font-semibold border rounded-lg",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                  error && "border-red-500"
                )}
                disabled={status === "verifying"}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {status === "verifying" && (
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          )}

          <div className="text-center">
            {canResend ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendCode}
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Resend code"}
              </Button>
            ) : (
              <p className="text-sm text-gray-500">Resend in {countdown}s</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
