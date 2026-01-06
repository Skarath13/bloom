import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

/**
 * PATCH /api/technician-blocks/[id]
 * Update a technician block
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, startTime, endTime, blockType, isActive, technicianId } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (blockType !== undefined) updateData.blockType = blockType;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (technicianId !== undefined) updateData.technicianId = technicianId;

    const { data: block, error } = await supabase
      .from(tables.technicianBlocks)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update technician block error:", error);
      return NextResponse.json(
        { error: "Failed to update block", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ block });
  } catch (error) {
    console.error("Update technician block error:", error);
    return NextResponse.json(
      { error: "Failed to update block" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/technician-blocks/[id]
 * Delete a technician block (soft delete by setting isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete by setting isActive to false
    const { error } = await supabase
      .from(tables.technicianBlocks)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Delete technician block error:", error);
      return NextResponse.json(
        { error: "Failed to delete block", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete technician block error:", error);
    return NextResponse.json(
      { error: "Failed to delete block" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/technician-blocks/[id]
 * Get a single technician block
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: block, error } = await supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Get technician block error:", error);
      return NextResponse.json(
        { error: "Block not found", details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ block });
  } catch (error) {
    console.error("Get technician block error:", error);
    return NextResponse.json(
      { error: "Failed to get block" },
      { status: 500 }
    );
  }
}
