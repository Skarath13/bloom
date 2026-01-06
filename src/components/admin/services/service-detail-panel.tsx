"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, DollarSign, CreditCard, Trash2, Package, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SERVICE_CATEGORIES, getCategoryLabel } from "@/lib/service-categories";
import { ServiceImageUpload } from "./service-image-upload";
import { ServiceLocations } from "./service-locations";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  isActive: boolean;
  isVariablePrice: boolean;
  imageUrl: string | null;
  locationIds: string[];
}

interface Location {
  id: string;
  name: string;
  city: string;
}

interface ServiceDetailPanelProps {
  service: Service;
  locations: Location[];
  onUpdate: (updates: Partial<Service>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLocationToggle: (locationId: string, enabled: boolean) => Promise<void>;
}

// Inline editable text component
function InlineEdit({
  value,
  onSave,
  className,
  multiline = false,
  placeholder = "Click to edit...",
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    const Component = multiline ? Textarea : Input;
    return (
      <div className="flex items-start gap-2">
        <Component
          ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn(className, "flex-1")}
          rows={multiline ? 3 : undefined}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer rounded-md transition-colors",
        "hover:bg-muted/50 px-2 py-1 -mx-2 -my-1",
        !value && "text-muted-foreground italic",
        multiline && "whitespace-pre-wrap",
        className
      )}
    >
      {value || placeholder}
    </div>
  );
}

// Duration options for salon services
const DURATION_OPTIONS = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 75, label: "1h 15m" },
  { value: 90, label: "1h 30m" },
  { value: 105, label: "1h 45m" },
  { value: 120, label: "2h" },
  { value: 150, label: "2h 30m" },
  { value: 180, label: "3h" },
  { value: 210, label: "3h 30m" },
  { value: 240, label: "4h" },
];

// Common price points
const PRICE_OPTIONS = [
  15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
  110, 120, 130, 140, 150, 160, 175, 185, 200, 225, 250, 275, 300, 350, 400, 450, 500
];

// Cancel fee options
const CANCEL_FEE_OPTIONS = [0, 25, 50, 75, 100, 125, 150, 175, 200];

// Duration selector component
function DurationSelect({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = DURATION_OPTIONS.find((opt) => opt.value === value);
  const displayLabel = currentOption?.label || formatDuration(value);

  useEffect(() => {
    if (isCustom && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isCustom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If user types a number, switch to custom mode
    if (/^[0-9]$/.test(e.key) && !isCustom) {
      e.preventDefault();
      setCustomValue(e.key);
      setIsCustom(true);
    }
  };

  const saveCustom = () => {
    const num = parseInt(customValue) || 0;
    if (num > 0) onSave(num);
    setIsCustom(false);
  };

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onBlur={saveCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCustom();
            else if (e.key === "Escape") {
              setCustomValue(value.toString());
              setIsCustom(false);
            }
          }}
          className="w-20 h-9 text-base font-semibold"
          placeholder="mins"
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} tabIndex={0} className="outline-none">
      <Select
        value={value.toString()}
        onValueChange={(v) => {
          if (v === "custom") {
            setCustomValue(value.toString());
            setIsCustom(true);
          } else {
            onSave(parseInt(v));
          }
        }}
      >
        <SelectTrigger className="w-[100px] h-9 font-semibold text-base border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DURATION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value="custom" className="text-muted-foreground">
            Custom...
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Price selector component
function PriceSelect({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCustom && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isCustom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key) && !isCustom) {
      e.preventDefault();
      setCustomValue(e.key);
      setIsCustom(true);
    }
  };

  const saveCustom = () => {
    const num = parseFloat(customValue) || 0;
    onSave(num);
    setIsCustom(false);
  };

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-base font-semibold">$</span>
        <Input
          ref={inputRef}
          type="number"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onBlur={saveCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCustom();
            else if (e.key === "Escape") {
              setCustomValue(value.toString());
              setIsCustom(false);
            }
          }}
          className="w-20 h-9 text-base font-semibold"
        />
      </div>
    );
  }

  const isPreset = PRICE_OPTIONS.includes(value);

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0} className="outline-none">
      <Select
        value={isPreset ? value.toString() : "custom"}
        onValueChange={(v) => {
          if (v === "custom") {
            setCustomValue(value.toString());
            setIsCustom(true);
          } else {
            onSave(parseInt(v));
          }
        }}
      >
        <SelectTrigger className="w-[90px] h-9 font-semibold text-base border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
          <SelectValue>${value}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {PRICE_OPTIONS.map((price) => (
            <SelectItem key={price} value={price.toString()}>
              ${price}
            </SelectItem>
          ))}
          <SelectItem value="custom" className="text-muted-foreground">
            Custom...
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Cancel fee selector component
function CancelFeeSelect({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCustom && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isCustom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key) && !isCustom) {
      e.preventDefault();
      setCustomValue(e.key);
      setIsCustom(true);
    }
  };

  const saveCustom = () => {
    const num = parseFloat(customValue) || 0;
    onSave(num);
    setIsCustom(false);
  };

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-base font-semibold">$</span>
        <Input
          ref={inputRef}
          type="number"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onBlur={saveCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCustom();
            else if (e.key === "Escape") {
              setCustomValue(value.toString());
              setIsCustom(false);
            }
          }}
          className="w-20 h-9 text-base font-semibold"
        />
      </div>
    );
  }

  const isPreset = CANCEL_FEE_OPTIONS.includes(value);

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0} className="outline-none">
      <Select
        value={isPreset ? value.toString() : "custom"}
        onValueChange={(v) => {
          if (v === "custom") {
            setCustomValue(value.toString());
            setIsCustom(true);
          } else {
            onSave(parseInt(v));
          }
        }}
      >
        <SelectTrigger className="w-[90px] h-9 font-semibold text-base border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
          <SelectValue>{value === 0 ? "None" : `$${value}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CANCEL_FEE_OPTIONS.map((fee) => (
            <SelectItem key={fee} value={fee.toString()}>
              {fee === 0 ? "None" : `$${fee}`}
            </SelectItem>
          ))}
          <SelectItem value="custom" className="text-muted-foreground">
            Custom...
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Helper to format duration as "1h 30m" style
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export function ServiceDetailPanel({
  service,
  locations,
  onUpdate,
  onDelete,
  onLocationToggle,
}: ServiceDetailPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFieldUpdate = async (field: keyof Service, value: unknown) => {
    try {
      await onUpdate({ [field]: value });
      // No success toast - optimistic UI is instant feedback
    } catch (error) {
      console.error("Failed to update:", error);
      // Error toast handled by parent
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success("Service deleted");
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete service");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header with image and name */}
        <div className="flex gap-6">
          <ServiceImageUpload
            imageUrl={service.imageUrl}
            serviceId={service.id}
            onUpload={(url) => handleFieldUpdate("imageUrl", url)}
            onRemove={() => handleFieldUpdate("imageUrl", null)}
          />
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <InlineEdit
                value={service.name}
                onSave={(name) => handleFieldUpdate("name", name)}
                className="text-2xl font-bold"
                placeholder="Service name"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="isActive" className="text-sm text-muted-foreground">
                  Active
                </Label>
                <Switch
                  id="isActive"
                  checked={service.isActive}
                  onCheckedChange={(checked) => handleFieldUpdate("isActive", checked)}
                />
              </div>
            </div>

            <Select
              value={service.category}
              onValueChange={(value) => handleFieldUpdate("category", value)}
            >
              <SelectTrigger className="w-fit h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <InlineEdit
              value={service.description || ""}
              onSave={(description) => handleFieldUpdate("description", description || null)}
              className="text-sm text-muted-foreground"
              multiline
              placeholder="Add a description..."
            />
          </div>
        </div>

        {/* Quick Settings Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Duration</span>
              </div>
              <DurationSelect
                value={service.durationMinutes}
                onSave={(v) => handleFieldUpdate("durationMinutes", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Price</span>
                </div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="variablePrice" className="text-xs text-muted-foreground">
                    Variable
                  </Label>
                  <Switch
                    id="variablePrice"
                    checked={service.isVariablePrice}
                    onCheckedChange={(checked) => handleFieldUpdate("isVariablePrice", checked)}
                    className="scale-75"
                  />
                </div>
              </div>
              {service.isVariablePrice ? (
                <Badge variant="secondary" className="text-amber-600 bg-amber-50">
                  Variable
                </Badge>
              ) : (
                <PriceSelect
                  value={service.price}
                  onSave={(v) => handleFieldUpdate("price", v)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Cancel Fee</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-xs">Charged for no-shows or cancellations within 6 hours. Protects commission-based technicians from lost income.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CancelFeeSelect
                value={service.depositAmount}
                onSave={(v) => handleFieldUpdate("depositAmount", v)}
              />
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Location Availability */}
        <ServiceLocations
          locations={locations}
          enabledLocationIds={service.locationIds}
          onToggle={onLocationToggle}
        />

        <Separator />

        {/* Danger Zone */}
        <div className="pt-4">
          <h3 className="text-sm font-medium text-destructive mb-3">Danger Zone</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Service
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{service.name}&quot;? This action cannot be
                  undone. Any appointments using this service will need to be updated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </ScrollArea>
  );
}

// Empty state when no service is selected
export function ServiceDetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Package className="h-16 w-16 mb-4 opacity-50" />
      <h3 className="text-lg font-medium mb-1">No Service Selected</h3>
      <p className="text-sm">Select a service from the list to view and edit details</p>
    </div>
  );
}
