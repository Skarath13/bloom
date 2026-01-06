import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * POST /api/services/[id]/image
 * Upload an image for a service
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be less than 5MB" }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${serviceId}-${Date.now()}.${ext}`;

    // Convert file to ArrayBuffer then to Uint8Array for upload
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("service-images")
      .upload(filename, uint8Array, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("service-images")
      .getPublicUrl(filename);

    const imageUrl = urlData.publicUrl;

    // Update service with image URL
    const { error: updateError } = await supabase
      .from(tables.services)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({ imageUrl })
      .eq("id", serviceId);

    if (updateError) {
      console.error("Update service error:", updateError);
      return NextResponse.json(
        { error: "Failed to update service with image URL", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Upload image error:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[id]/image
 * Remove the image from a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;

    // Get current image URL
    const { data: serviceData, error: fetchError } = await supabase
      .from(tables.services)
      .select("imageUrl")
      .eq("id", serviceId)
      .single();

    if (fetchError) {
      console.error("Fetch service error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch service", details: fetchError.message },
        { status: 500 }
      );
    }

    const service = serviceData as { imageUrl: string | null } | null;

    // Delete from storage if URL exists
    if (service?.imageUrl) {
      const filename = service.imageUrl.split("/").pop();
      if (filename) {
        await supabase.storage.from("service-images").remove([filename]);
      }
    }

    // Clear image URL in database
    const { error: updateError } = await supabase
      .from(tables.services)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({ imageUrl: null })
      .eq("id", serviceId);

    if (updateError) {
      console.error("Update service error:", updateError);
      return NextResponse.json(
        { error: "Failed to clear image URL", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete image error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
