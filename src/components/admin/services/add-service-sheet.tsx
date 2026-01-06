"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { ServiceImageUpload } from "./service-image-upload";

interface Location {
  id: string;
  name: string;
  city: string;
}

interface AddServiceSheetProps {
  locations: Location[];
  onServiceCreated: (service: NewService) => Promise<void>;
  children?: React.ReactNode;
}

interface NewService {
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

const initialFormData: NewService = {
  name: "",
  description: null,
  category: "SIGNATURE_SETS",
  durationMinutes: 60,
  price: 0,
  depositAmount: 25,
  isActive: true,
  isVariablePrice: false,
  imageUrl: null,
  locationIds: [],
};

export function AddServiceSheet({ locations, onServiceCreated, children }: AddServiceSheetProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<NewService>(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const toggleLocation = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(locationId)
        ? prev.locationIds.filter((id) => id !== locationId)
        : [...prev.locationIds, locationId],
    }));
  };

  const selectAllLocations = () => {
    setFormData((prev) => ({
      ...prev,
      locationIds: locations.map((l) => l.id),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    if (formData.locationIds.length === 0) {
      toast.error("Please select at least one location");
      return;
    }

    if (!formData.isVariablePrice && formData.price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsCreating(true);

    try {
      await onServiceCreated(formData);
      toast.success("Service created");
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create service:", error);
      toast.error("Failed to create service");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <SheetTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Add New Service</SheetTitle>
          <SheetDescription>
            Create a new service for your menu
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Image Upload */}
            <div className="flex justify-center">
              <ServiceImageUpload
                imageUrl={formData.imageUrl}
                onUpload={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
                onRemove={() => setFormData((prev) => ({ ...prev, imageUrl: null }))}
                size="lg"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Natural Volume Set"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
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
            </div>

            {/* Duration, Price, Deposit */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    durationMinutes: parseInt(e.target.value) || 0,
                  }))}
                  min={15}
                  step={15}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))}
                  min={0}
                  disabled={formData.isVariablePrice}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit ($)</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    depositAmount: parseFloat(e.target.value) || 0,
                  }))}
                  min={0}
                />
              </div>
            </div>

            {/* Variable Price Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Switch
                id="variablePrice"
                checked={formData.isVariablePrice}
                onCheckedChange={(checked) => setFormData((prev) => ({
                  ...prev,
                  isVariablePrice: checked,
                }))}
              />
              <div>
                <Label htmlFor="variablePrice" className="cursor-pointer">
                  Variable Pricing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Price varies based on consultation
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  description: e.target.value || null,
                }))}
                placeholder="Describe the service, pricing tiers, etc..."
                rows={3}
              />
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Available at Locations *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 text-xs"
                  onClick={selectAllLocations}
                >
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {locations.map((loc) => {
                  const isSelected = formData.locationIds.includes(loc.id);
                  return (
                    <div
                      key={loc.id}
                      onClick={() => toggleLocation(loc.id)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleLocation(loc.id)}
                        className="pointer-events-none"
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium block truncate">{loc.name}</span>
                        <span className="text-xs text-muted-foreground">{loc.city}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({
                  ...prev,
                  isActive: checked,
                }))}
              />
              <div>
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Service is visible and bookable
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Service
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
