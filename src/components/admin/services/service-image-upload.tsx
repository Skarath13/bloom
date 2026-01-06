"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ServiceImageUploadProps {
  imageUrl: string | null;
  serviceId?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  size?: "default" | "lg";
  disabled?: boolean;
}

export function ServiceImageUpload({
  imageUrl,
  serviceId,
  onUpload,
  onRemove,
  size = "default",
  disabled = false,
}: ServiceImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = size === "lg" ? "w-40 h-40" : "w-32 h-32";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const uploadFile = async (file: File) => {

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      // If we have a serviceId, upload to the API
      if (serviceId) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/services/${serviceId}/image`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }

        const data = await response.json();
        onUpload(data.imageUrl);
        toast.success("Image uploaded");
      } else {
        // For new services, create a temporary URL preview
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            onUpload(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    // Try dataTransfer.files first (standard - from Finder/file system)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
      return;
    }

    // Try dataTransfer.items for files
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            uploadFile(file);
            return;
          }
        }
      }

      // Handle URL drops (from browser/webpages)
      const uriItem = Array.from(e.dataTransfer.items).find(
        (item) => item.type === "text/uri-list"
      );
      if (uriItem) {
        uriItem.getAsString(async (url) => {
          if (url && (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes("image"))) {
            await fetchAndUploadFromUrl(url);
          } else {
            toast.error("Please drop an image file");
          }
        });
        return;
      }
    }

    toast.error("Please drag an image from Finder or your desktop");
  };

  const fetchAndUploadFromUrl = async (url: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch image");

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("URL is not an image");
      }

      const filename = url.split("/").pop() || "image.jpg";
      const file = new File([blob], filename, { type: blob.type });
      await uploadFile(file);
    } catch (error) {
      console.error("Failed to fetch image from URL:", error);
      toast.error("Could not load image from URL. Try dragging from Finder instead.");
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (serviceId && imageUrl && !imageUrl.startsWith("data:")) {
      try {
        const response = await fetch(`/api/services/${serviceId}/image`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove image");
        }
      } catch (error) {
        console.error("Error removing image:", error);
        toast.error("Failed to remove image");
        return;
      }
    }

    onRemove();
    toast.success("Image removed");
  };

  return (
    <div
      className={cn(
        "relative group rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden",
        sizeClasses,
        isDragging && "border-primary bg-primary/5 scale-105",
        !isDragging && !imageUrl && "border-muted-foreground/25 hover:border-muted-foreground/50",
        imageUrl && "border-solid border-transparent",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
    >
      {isUploading ? (
        <div className="flex flex-col items-center justify-center h-full bg-muted/50 pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground mt-2">Uploading...</span>
        </div>
      ) : imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt="Service"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground pointer-events-none">
          <ImageIcon className={cn("mb-2", size === "lg" ? "h-10 w-10" : "h-8 w-8")} />
          <span className={cn("text-center px-2", size === "lg" ? "text-sm" : "text-xs")}>
            {isDragging ? "Drop image" : "Drop or click"}
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </div>
  );
}
