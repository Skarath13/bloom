"use client";

import { useState } from "react";
import {
  X,
  Clock,
  DollarSign,
  MapPin,
  Trash2,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface MobileServiceDetailSheetProps {
  service: Service | null;
  locations: Location[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<Service>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLocationToggle: (locationId: string, enabled: boolean) => Promise<void>;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function MobileServiceDetailSheet({
  service,
  locations,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onLocationToggle,
}: MobileServiceDetailSheetProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!service) return null;

  const handleActiveToggle = async (checked: boolean) => {
    setIsSaving(true);
    try {
      await onUpdate({ isActive: checked });
      toast.success(checked ? "Service activated" : "Service deactivated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationToggle = async (locationId: string, enabled: boolean) => {
    try {
      await onLocationToggle(locationId, enabled);
    } catch {
      toast.error("Failed to update location");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onOpenChange(false);
      toast.success("Service deleted");
    } catch {
      toast.error("Failed to delete service");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-full rounded-none p-0 flex flex-col [&>button]:hidden"
        >
          <SheetTitle className="sr-only">{service.name}</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage service details
          </SheetDescription>

          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold truncate px-2">Service Details</h1>
            <div className="min-w-[44px]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Service Header */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-gray-400">
                      {service.name[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate">{service.name}</h2>
                  <p className="text-sm text-gray-500">{service.category}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch
                      checked={service.isActive}
                      onCheckedChange={handleActiveToggle}
                      disabled={isSaving}
                    />
                    <span className="text-sm text-gray-600">
                      {service.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {service.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Description</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {service.description}
                  </p>
                </div>
              )}

              {/* Quick Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Clock className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                  <div className="font-semibold">{formatDuration(service.durationMinutes)}</div>
                  <div className="text-[10px] text-gray-500">Duration</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <DollarSign className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                  <div className="font-semibold">
                    {service.isVariablePrice ? `$${service.price}+` : `$${service.price}`}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {service.isVariablePrice ? "Starting at" : "Price"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <DollarSign className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                  <div className="font-semibold">${service.depositAmount}</div>
                  <div className="text-[10px] text-gray-500">Cancel Fee</div>
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700">Available Locations</h3>
                </div>
                <div className="space-y-2">
                  {locations.map((location) => {
                    const isEnabled = service.locationIds.includes(location.id);
                    return (
                      <div
                        key={location.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg transition-colors",
                          isEnabled ? "bg-green-50" : "bg-gray-50"
                        )}
                      >
                        <div>
                          <div className="font-medium text-sm">{location.name}</div>
                          <div className="text-xs text-gray-500">{location.city}</div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleLocationToggle(location.id, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delete Section */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Service
                </Button>
              </div>
            </div>

            {/* Bottom padding for nav */}
            <div className="h-20" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{service.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
