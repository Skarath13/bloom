import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

interface BlockData {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: string | null;
  endTime: string | null;
  recurrenceRule: string | null;
  recurringStart: string | null;
  recurringEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/technician-blocks
 * Fetch technician blocks, optionally filtered by technician
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const technicianId = searchParams.get("technicianId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("isActive", true)
      .order("startTime", { ascending: true });

    if (technicianId) {
      query = query.eq("technicianId", technicianId);
    }

    if (startDate && endDate) {
      // Filter blocks that start within the date range
      query = query
        .gte("startTime", `${startDate}T00:00:00`)
        .lte("startTime", `${endDate}T23:59:59`);
    }

    const { data: blocks, error } = await query as { data: BlockData[] | null; error: { message: string } | null };

    if (error) {
      console.error("Fetch technician blocks error:", error);
      return NextResponse.json(
        { error: "Failed to fetch technician blocks", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ blocks: blocks || [] });
  } catch (error) {
    console.error("Fetch technician blocks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch technician blocks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/technician-blocks
 * Create a new technician block (personal event)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      technicianId,
      title,
      blockType = "PERSONAL",
      startTime,
      endTime,
      recurrenceRule,
      isActive = true,
    } = body;

    // Validate required fields
    if (!technicianId || !title) {
      return NextResponse.json(
        { error: "Missing required fields: technicianId and title are required" },
        { status: 400 }
      );
    }

    const newBlock = {
      id: generateId(),
      technicianId,
      title,
      blockType,
      startTime: startTime || null,
      endTime: endTime || null,
      recurrenceRule: recurrenceRule || null,
      recurringStart: null,
      recurringEnd: null,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: block, error } = await supabase
      .from(tables.technicianBlocks)
      .insert(newBlock)
      .select()
      .single() as { data: BlockData | null; error: { message: string } | null };

    if (error) {
      console.error("Create technician block error:", error);
      return NextResponse.json(
        { error: "Failed to create technician block", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, block });
  } catch (error) {
    console.error("Create technician block error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create technician block" },
      { status: 500 }
    );
  }
}
