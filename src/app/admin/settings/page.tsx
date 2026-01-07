"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Building2,
  Bell,
  CreditCard,
  Clock,
  MessageSquare,
  Shield,
  Loader2,
  ExternalLink,
  Pencil,
  ChevronDown,
  ChevronUp,
  Check,
  Plug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "booking", label: "Booking Policies", icon: Clock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Plug },
];

// Reminder configuration
const reminderConfig = [
  {
    key: "reminder48h",
    enabledKey: "reminder48hEnabled",
    messageKey: "reminder48hMessage",
    label: "48 hours before",
    description: "Two days before the appointment",
  },
  {
    key: "reminder24h",
    enabledKey: "reminder24hEnabled",
    messageKey: "reminder24hMessage",
    label: "24 hours before",
    description: "One day before the appointment",
  },
  {
    key: "reminder12h",
    enabledKey: "reminder12hEnabled",
    messageKey: "reminder12hMessage",
    label: "12 hours before",
    description: "Morning of / night before",
  },
  {
    key: "reminder6h",
    enabledKey: "reminder6hEnabled",
    messageKey: "reminder6hMessage",
    label: "6 hours before",
    description: "Same day, hours before",
  },
  {
    key: "reminder2h",
    enabledKey: "reminder2hEnabled",
    messageKey: "reminder2hMessage",
    label: "2 hours before",
    description: "Final reminder",
  },
];

interface Settings {
  // Business
  businessName: string;
  email: string;
  phone: string;
  website: string;
  timezone: string;
  // Booking
  defaultDepositAmount: number;
  cancellationWindowHours: number;
  noShowFeeEnabled: boolean;
  noShowFeeAmount: number;
  requireCardOnFile: boolean;
  allowSameDayBooking: boolean;
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  defaultBufferMinutes: number;
  // Notifications
  smsRemindersEnabled: boolean;
  reminder48hEnabled: boolean;
  reminder48hMessage: string;
  reminder24hEnabled: boolean;
  reminder24hMessage: string;
  reminder12hEnabled: boolean;
  reminder12hMessage: string;
  reminder6hEnabled: boolean;
  reminder6hMessage: string;
  reminder2hEnabled: boolean;
  reminder2hMessage: string;
  confirmationSmsEnabled: boolean;
  cancellationSmsEnabled: boolean;
  noShowSmsEnabled: boolean;
  // Payments
  acceptCard: boolean;
  acceptCash: boolean;
  acceptApplePay: boolean;
  acceptGooglePay: boolean;
}

const defaultSettings: Settings = {
  businessName: "",
  email: "",
  phone: "",
  website: "",
  timezone: "America/Los_Angeles",
  defaultDepositAmount: 25,
  cancellationWindowHours: 24,
  noShowFeeEnabled: true,
  noShowFeeAmount: 50,
  requireCardOnFile: true,
  allowSameDayBooking: true,
  minAdvanceBookingHours: 2,
  maxAdvanceBookingDays: 60,
  defaultBufferMinutes: 15,
  smsRemindersEnabled: true,
  reminder48hEnabled: true,
  reminder48hMessage: "",
  reminder24hEnabled: true,
  reminder24hMessage: "",
  reminder12hEnabled: false,
  reminder12hMessage: "",
  reminder6hEnabled: false,
  reminder6hMessage: "",
  reminder2hEnabled: true,
  reminder2hMessage: "",
  confirmationSmsEnabled: true,
  cancellationSmsEnabled: true,
  noShowSmsEnabled: false,
  acceptCard: true,
  acceptCash: true,
  acceptApplePay: true,
  acceptGooglePay: true,
};

// Integration types
interface SecretKey {
  key: string;
  label: string;
  description: string;
  required: boolean;
  masked: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_enabled: boolean;
  secret_keys: SecretKey[];
  config: Record<string, string>;
  secrets_configured: Record<string, boolean>;
  all_required_configured: boolean;
}

interface SecretStatus {
  exists: boolean;
  masked: string;
}

const SETTINGS_TAB_KEY = "bloom-settings-active-tab";
const AUTO_SAVE_DELAY = 1000; // 1 second debounce

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem(SETTINGS_TAB_KEY);
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Expanded state for each reminder
  const [expandedReminders, setExpandedReminders] = useState<Record<string, boolean>>({});

  // Edit modal state
  const [editingReminder, setEditingReminder] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    reminderKey: string;
    newMessage: string;
  }>({ open: false, reminderKey: "", newMessage: "" });

  // Dangerous setting change confirmation
  const [pendingChange, setPendingChange] = useState<{
    key: keyof Settings;
    value: boolean;
    title: string;
    description: string;
  } | null>(null);

  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [vaultConfigured, setVaultConfigured] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [integrationSecrets, setIntegrationSecrets] = useState<Record<string, SecretStatus>>({});
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [integrationSaving, setIntegrationSaving] = useState(false);

  // Fetch integrations from API
  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const response = await fetch("/api/integrations");
      const data = await response.json();
      if (data.integrations) {
        setIntegrations(data.integrations);
      }
      if (data.vault_configured !== undefined) {
        setVaultConfigured(data.vault_configured);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  // Fetch integration details (with secrets)
  const fetchIntegrationDetails = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/integrations/${id}`);
      const data = await response.json();
      if (data.secrets) {
        setIntegrationSecrets(data.secrets);
      }
    } catch (error) {
      console.error("Error fetching integration details:", error);
    }
  }, []);

  // Save integration secrets
  const saveIntegrationSecrets = async (integrationId: string) => {
    setIntegrationSaving(true);
    try {
      // Only send non-empty secrets
      const secretsToSave: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(secretInputs)) {
        if (value.trim() !== "") {
          secretsToSave[key] = value.trim();
        }
      }

      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secrets: secretsToSave }),
      });

      if (!response.ok) throw new Error("Failed to save secrets");

      const data = await response.json();
      if (data.secrets) {
        setIntegrationSecrets(data.secrets);
      }

      // Clear inputs and refresh
      setSecretInputs({});
      toast.success("Secrets saved successfully");
      fetchIntegrations();
    } catch (error) {
      console.error("Error saving integration:", error);
      toast.error("Failed to save secrets");
    } finally {
      setIntegrationSaving(false);
    }
  };

  // Test integration connection
  const testIntegration = async (id: string) => {
    setTestingIntegration(id);
    try {
      const response = await fetch(`/api/integrations/${id}/test`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message || "Connection successful!");
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch (error) {
      console.error("Error testing integration:", error);
      toast.error("Failed to test connection");
    } finally {
      setTestingIntegration(null);
    }
  };

  // Load integrations when tab is active
  useEffect(() => {
    if (activeTab === "integrations" && integrations.length === 0) {
      fetchIntegrations();
    }
  }, [activeTab, integrations.length, fetchIntegrations]);

  // Load integration details when editing
  useEffect(() => {
    if (editingIntegration) {
      fetchIntegrationDetails(editingIntegration);
      setSecretInputs({});
      setShowSecrets({});
    }
  }, [editingIntegration, fetchIntegrationDetails]);

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
      // Mark initial load complete after a short delay to prevent immediate save
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Auto-save when settings change (with debounce)
  const saveSettings = useCallback(async (settingsToSave: Settings) => {
    setSaveStatus("saving");
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      setSaveStatus("saved");

      // Clear "saved" indicator after 2 seconds
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }
      savedIndicatorTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
      setSaveStatus("idle");
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Auto-save effect with debounce
  useEffect(() => {
    // Skip initial load
    if (isInitialLoad.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings(settings);
    }, AUTO_SAVE_DELAY);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings, saveSettings]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current);
    };
  }, []);

  // Handle tab change with localStorage persistence
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    localStorage.setItem(SETTINGS_TAB_KEY, tabId);
  };

  // Update a single setting (auto-saves via effect)
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Dangerous setting confirmations config
  const dangerousSettings: Record<string, { disableTitle: string; disableDesc: string; enableTitle?: string; enableDesc?: string }> = {
    allowSameDayBooking: {
      disableTitle: "Disable Same-Day Booking?",
      disableDesc: "Clients will no longer be able to book appointments for the current day. This may result in lost bookings from walk-in or last-minute customers.",
    },
    requireCardOnFile: {
      disableTitle: "Disable Card Requirement?",
      disableDesc: "Clients will be able to book without providing a payment method. This removes no-show protection for new bookings.",
    },
    noShowFeeEnabled: {
      disableTitle: "Disable No-Show Fees?",
      disableDesc: "You will no longer be able to charge clients who miss appointments. This may increase no-show rates.",
    },
    smsRemindersEnabled: {
      disableTitle: "Disable SMS Reminders?",
      disableDesc: "Clients will no longer receive automated text reminders before their appointments. This may increase no-show rates.",
    },
    confirmationSmsEnabled: {
      disableTitle: "Disable Booking Confirmations?",
      disableDesc: "Clients will no longer receive SMS confirmation when they book an appointment.",
    },
    acceptCard: {
      disableTitle: "Disable Card Payments?",
      disableDesc: "Clients will not be able to pay with credit or debit cards. Only cash payments will be accepted.",
    },
    acceptCash: {
      disableTitle: "Disable Cash Payments?",
      disableDesc: "Cash payments will no longer be accepted. Clients must pay with card.",
    },
  };

  // Handle dangerous setting toggle with confirmation
  const handleDangerousSettingChange = (key: keyof Settings, checked: boolean) => {
    const config = dangerousSettings[key];
    if (!config) {
      updateSetting(key, checked as never);
      return;
    }

    // Only show confirmation when disabling (turning off)
    if (!checked) {
      setPendingChange({
        key,
        value: checked,
        title: config.disableTitle,
        description: config.disableDesc,
      });
    } else {
      updateSetting(key, checked as never);
    }
  };

  const confirmPendingChange = () => {
    if (pendingChange) {
      updateSetting(pendingChange.key, pendingChange.value as never);
      setPendingChange(null);
    }
  };

  const toggleReminderExpanded = (key: string) => {
    setExpandedReminders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openEditModal = (messageKey: string) => {
    setEditingReminder(messageKey);
    setEditingMessage(settings[messageKey as keyof Settings] as string);
  };

  const handleSaveMessage = () => {
    if (!editingReminder) return;

    const currentMessage = settings[editingReminder as keyof Settings] as string;

    // Check if message actually changed
    if (editingMessage === currentMessage) {
      setEditingReminder(null);
      return;
    }

    // Show confirmation dialog
    setConfirmDialog({
      open: true,
      reminderKey: editingReminder,
      newMessage: editingMessage,
    });
  };

  const confirmMessageChange = async () => {
    const key = confirmDialog.reminderKey as keyof Settings;
    const newMessage = confirmDialog.newMessage;

    // Update locally first
    setSettings((prev) => ({
      ...prev,
      [key]: newMessage,
    }));

    // Save to database
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newMessage }),
      });

      if (!response.ok) throw new Error("Failed to save message");

      toast.success("SMS message updated");
    } catch (error) {
      console.error("Error saving message:", error);
      toast.error("Failed to save message");
      // Revert on error
      await fetchSettings();
    } finally {
      setIsSaving(false);
      setConfirmDialog({ open: false, reminderKey: "", newMessage: "" });
      setEditingReminder(null);
    }
  };

  const getReminderLabel = (key: string) => {
    return reminderConfig.find((r) => r.messageKey === key)?.label || key;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your booking system preferences
          </p>
        </div>
        {/* Auto-save status indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar navigation */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Business Settings */}
          {activeTab === "business" && (
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>
                  Basic information about your business
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      value={settings.businessName}
                      onChange={(e) => updateSetting("businessName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => updateSetting("email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={settings.phone}
                      onChange={(e) => updateSetting("phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={settings.website}
                      onChange={(e) => updateSetting("website", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => updateSetting("timezone", value)}
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Los_Angeles">
                        Pacific Time (PT)
                      </SelectItem>
                      <SelectItem value="America/Denver">
                        Mountain Time (MT)
                      </SelectItem>
                      <SelectItem value="America/Chicago">
                        Central Time (CT)
                      </SelectItem>
                      <SelectItem value="America/New_York">
                        Eastern Time (ET)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </CardContent>
            </Card>
          )}

          {/* Booking Policies */}
          {activeTab === "booking" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit & Payment</CardTitle>
                  <CardDescription>
                    Configure deposit requirements for new bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Card on File</Label>
                      <p className="text-sm text-muted-foreground">
                        Clients must provide a card when booking
                      </p>
                    </div>
                    <Switch
                      checked={settings.requireCardOnFile}
                      onCheckedChange={(checked) => handleDangerousSettingChange("requireCardOnFile", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositAmount">Default Deposit Amount</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        id="depositAmount"
                        type="number"
                        className="w-24"
                        value={settings.defaultDepositAmount}
                        onChange={(e) =>
                          updateSetting("defaultDepositAmount", Number(e.target.value))
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Individual services can override this amount
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    No-Show Protection
                  </CardTitle>
                  <CardDescription>
                    Protect your business from no-shows and late cancellations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable No-Show Fees</Label>
                      <p className="text-sm text-muted-foreground">
                        Charge clients who miss appointments without notice
                      </p>
                    </div>
                    <Switch
                      checked={settings.noShowFeeEnabled}
                      onCheckedChange={(checked) => handleDangerousSettingChange("noShowFeeEnabled", checked)}
                    />
                  </div>

                  {settings.noShowFeeEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="noShowFee">No-Show Fee Amount</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="noShowFee"
                            type="number"
                            className="w-24"
                            value={settings.noShowFeeAmount}
                            onChange={(e) =>
                              updateSetting("noShowFeeAmount", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cancellationWindow">
                          Cancellation Window
                        </Label>
                        <Select
                          value={String(settings.cancellationWindowHours)}
                          onValueChange={(value) =>
                            updateSetting("cancellationWindowHours", Number(value))
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6 hours</SelectItem>
                            <SelectItem value="12">12 hours</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="48">48 hours</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          Cancellations within this window may be charged
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Booking Restrictions</CardTitle>
                  <CardDescription>
                    Control when clients can book appointments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Same-Day Booking</Label>
                      <p className="text-sm text-muted-foreground">
                        Clients can book appointments for today
                      </p>
                    </div>
                    <Switch
                      checked={settings.allowSameDayBooking}
                      onCheckedChange={(checked) => handleDangerousSettingChange("allowSameDayBooking", checked)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Minimum Advance Notice</Label>
                      <Select
                        value={String(settings.minAdvanceBookingHours)}
                        onValueChange={(value) =>
                          updateSetting("minAdvanceBookingHours", Number(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No minimum</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Maximum Advance Booking</Label>
                      <Select
                        value={String(settings.maxAdvanceBookingDays)}
                        onValueChange={(value) =>
                          updateSetting("maxAdvanceBookingDays", Number(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Buffer Time</Label>
                    <Select
                      value={String(settings.defaultBufferMinutes)}
                      onValueChange={(value) =>
                        updateSetting("defaultBufferMinutes", Number(value))
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No buffer</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Time between appointments for cleanup/prep
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    SMS Reminder Flow
                  </CardTitle>
                  <CardDescription>
                    Configure automated appointment reminders. Each reminder can
                    have its own custom message.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable SMS Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send automated text reminders to clients
                      </p>
                    </div>
                    <Switch
                      checked={settings.smsRemindersEnabled}
                      onCheckedChange={(checked) => handleDangerousSettingChange("smsRemindersEnabled", checked)}
                    />
                  </div>

                  {settings.smsRemindersEnabled && (
                    <>
                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Reminder Messages</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Toggle and customize each reminder in your flow
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {reminderConfig.map((reminder) => {
                            const isEnabled = settings[reminder.enabledKey as keyof Settings] as boolean;
                            const isExpanded = expandedReminders[reminder.key];
                            const message = settings[reminder.messageKey as keyof Settings] as string;

                            return (
                              <div
                                key={reminder.key}
                                className={cn(
                                  "border rounded-lg transition-colors",
                                  isEnabled
                                    ? "border-border"
                                    : "border-border/50 bg-muted/30"
                                )}
                              >
                                {/* Header row */}
                                <div className="flex items-center justify-between p-4">
                                  <div className="flex items-center gap-3">
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(checked) =>
                                        updateSetting(
                                          reminder.enabledKey as keyof Settings,
                                          checked as never
                                        )
                                      }
                                    />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={cn(
                                            "font-medium",
                                            !isEnabled && "text-muted-foreground"
                                          )}
                                        >
                                          {reminder.label}
                                        </span>
                                        {isEnabled && (
                                          <Badge
                                            variant="outline"
                                            className="text-green-600 border-green-600 text-xs"
                                          >
                                            Active
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {reminder.description}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isEnabled && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditModal(reminder.messageKey)}
                                      >
                                        <Pencil className="h-4 w-4 mr-1" />
                                        Edit
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        toggleReminderExpanded(reminder.key)
                                      }
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {/* Expanded message preview */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-0">
                                    <div className="bg-muted/50 rounded-lg p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          SMS Preview
                                        </span>
                                      </div>
                                      <p
                                        className={cn(
                                          "text-sm whitespace-pre-wrap select-text cursor-text",
                                          !isEnabled && "text-muted-foreground"
                                        )}
                                      >
                                        {message}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 mt-4 select-text">
                          <p className="text-sm text-muted-foreground">
                            <strong>Available variables:</strong>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{firstName}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{lastName}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{date}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{time}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{serviceName}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{technicianName}"}
                            </code>{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {"{locationName}"}
                            </code>
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Other Notifications</CardTitle>
                  <CardDescription>
                    Control other automated messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Booking Confirmation</Label>
                      <p className="text-sm text-muted-foreground">
                        Send confirmation when appointment is booked
                      </p>
                    </div>
                    <Switch
                      checked={settings.confirmationSmsEnabled}
                      onCheckedChange={(checked) => handleDangerousSettingChange("confirmationSmsEnabled", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cancellation Notice</Label>
                      <p className="text-sm text-muted-foreground">
                        Send notice when appointment is cancelled
                      </p>
                    </div>
                    <Switch
                      checked={settings.cancellationSmsEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting("cancellationSmsEnabled", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>No-Show Notice</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify client when marked as no-show
                      </p>
                    </div>
                    <Switch
                      checked={settings.noShowSmsEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting("noShowSmsEnabled", checked)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Payments */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Accepted Payment Methods</CardTitle>
                  <CardDescription>
                    Choose which payment methods clients can use at checkout.
                    Configure Stripe API keys in the <button className="underline hover:text-foreground" onClick={() => setActiveTab("integrations")}>Integrations</button> tab.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Credit/Debit Cards</Label>
                      <p className="text-sm text-muted-foreground">
                        Visa, Mastercard, Amex, Discover
                      </p>
                    </div>
                    <Switch
                      checked={settings.acceptCard}
                      onCheckedChange={(checked) => handleDangerousSettingChange("acceptCard", checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Apple Pay</Label>
                      <p className="text-sm text-muted-foreground">
                        One-tap checkout on iOS devices
                      </p>
                    </div>
                    <Switch
                      checked={settings.acceptApplePay}
                      onCheckedChange={(checked) => updateSetting("acceptApplePay", checked)}
                      disabled={!settings.acceptCard}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Google Pay</Label>
                      <p className="text-sm text-muted-foreground">
                        One-tap checkout on Android devices
                      </p>
                    </div>
                    <Switch
                      checked={settings.acceptGooglePay}
                      onCheckedChange={(checked) => updateSetting("acceptGooglePay", checked)}
                      disabled={!settings.acceptCard}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cash</Label>
                      <p className="text-sm text-muted-foreground">
                        Accept cash payments in-person
                      </p>
                    </div>
                    <Switch
                      checked={settings.acceptCash}
                      onCheckedChange={(checked) => handleDangerousSettingChange("acceptCash", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Integrations */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              {!vaultConfigured && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-600">Vault Not Configured</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          To save secrets securely, add <code className="bg-muted px-1 py-0.5 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to your environment variables.
                          You can find this in your Supabase project settings under API.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>API Integrations</CardTitle>
                  <CardDescription>
                    Manage your third-party service connections. Secrets are encrypted using industry-standard encryption (pgsodium/libsodium).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {integrationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : integrations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No integrations available.
                    </p>
                  ) : (
                    integrations.map((integration) => {
                      const isEditing = editingIntegration === integration.id;
                      const isTesting = testingIntegration === integration.id;
                      const IntegrationIcon = integration.id === "stripe" ? CreditCard : MessageSquare;
                      const iconBg = integration.id === "stripe" ? "bg-[#635BFF]" : "bg-[#F22F46]";

                      return (
                        <div key={integration.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center`}>
                                <IntegrationIcon className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{integration.name}</span>
                                  {integration.all_required_configured ? (
                                    <Badge variant="default" className="text-xs bg-green-500/20 text-green-600 hover:bg-green-500/20">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Configured
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Not Configured
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {integration.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.all_required_configured && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => testIntegration(integration.id)}
                                  disabled={isTesting}
                                >
                                  {isTesting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  Test
                                </Button>
                              )}
                              <Button
                                variant={isEditing ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setEditingIntegration(isEditing ? null : integration.id)}
                              >
                                {isEditing ? "Close" : "Configure"}
                              </Button>
                            </div>
                          </div>

                          {/* Secret configuration panel */}
                          {isEditing && (
                            <div className="mt-4 pt-4 border-t space-y-4">
                              {integration.secret_keys.map((secretKey) => {
                                const secretStatus = integrationSecrets[secretKey.key];
                                const inputValue = secretInputs[secretKey.key] || "";
                                const isShowingSecret = showSecrets[secretKey.key];

                                return (
                                  <div key={secretKey.key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="flex items-center gap-2">
                                        {secretKey.label}
                                        {secretKey.required && (
                                          <span className="text-red-500 text-xs">*</span>
                                        )}
                                        {secretStatus?.exists && (
                                          <Badge variant="outline" className="text-xs text-green-600">
                                            <Check className="h-3 w-3 mr-1" />
                                            Set
                                          </Badge>
                                        )}
                                      </Label>
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <Input
                                          type={secretKey.masked && !isShowingSecret ? "password" : "text"}
                                          placeholder={
                                            secretStatus?.exists
                                              ? `Current: ${secretStatus.masked}`
                                              : secretKey.description
                                          }
                                          value={inputValue}
                                          onChange={(e) =>
                                            setSecretInputs((prev) => ({
                                              ...prev,
                                              [secretKey.key]: e.target.value,
                                            }))
                                          }
                                          className="pr-10"
                                        />
                                        {secretKey.masked && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                            onClick={() =>
                                              setShowSecrets((prev) => ({
                                                ...prev,
                                                [secretKey.key]: !prev[secretKey.key],
                                              }))
                                            }
                                          >
                                            {isShowingSecret ? (
                                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {secretKey.description}
                                    </p>
                                  </div>
                                );
                              })}

                              <div className="flex items-center justify-between pt-2">
                                {!vaultConfigured && (
                                  <p className="text-xs text-amber-600">
                                    Add SUPABASE_SERVICE_ROLE_KEY to enable saving
                                  </p>
                                )}
                                <div className="flex gap-2 ml-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingIntegration(null);
                                      setSecretInputs({});
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveIntegrationSecrets(integration.id)}
                                    disabled={!vaultConfigured || integrationSaving || Object.keys(secretInputs).length === 0}
                                  >
                                    {integrationSaving ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Shield className="h-4 w-4 mr-2" />
                                    )}
                                    Save Secrets
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <Shield className="h-8 w-8" />
                    <div>
                      <p className="font-medium text-foreground">Secure Storage</p>
                      <p className="text-sm">
                        All secrets are encrypted at rest using Supabase Vault with pgsodium (libsodium).
                        Only encrypted values are stored - decryption happens at runtime.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Edit Message Modal */}
      <Dialog
        open={editingReminder !== null}
        onOpenChange={(open) => !open && setEditingReminder(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit {editingReminder && getReminderLabel(editingReminder)} Message
            </DialogTitle>
            <DialogDescription>
              Customize the SMS message sent at this reminder time
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editMessage">Message Content</Label>
              <Textarea
                id="editMessage"
                rows={5}
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                placeholder="Enter your reminder message..."
              />
              <p className="text-xs text-muted-foreground">
                {editingMessage.length} characters
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 select-text">
              <p className="text-sm text-muted-foreground">
                <strong>Available variables:</strong>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{firstName}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{lastName}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{date}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{time}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{serviceName}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{technicianName}"}
                </code>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {"{locationName}"}
                </code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReminder(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMessage}>Save Message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, reminderKey: "", newMessage: "" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Message Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update the{" "}
              <strong>{getReminderLabel(confirmDialog.reminderKey)}</strong>{" "}
              reminder message? This will affect all future SMS reminders sent at
              this time.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">New message:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap select-text cursor-text">
              {confirmDialog.newMessage}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMessageChange}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dangerous Setting Change Confirmation */}
      <AlertDialog open={pendingChange !== null} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingChange?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingChange}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
