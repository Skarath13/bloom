import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId, type RecurrenceException } from "@/lib/supabase";
import { expandRecurrence } from "@/lib/recurrence";
import { startOfDay, endOfDay, parseISO, isBefore, isAfter } from "date-fns";

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
  recurrenceExceptions: RecurrenceException[];
  parentBlockId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExpandedBlock extends BlockData {
  instanceDate?: string;
  isRecurring?: boolean;
}

/**
 * GET /api/technician-blocks
 * Fetch technician blocks, optionally filtered by technician
 * Expands recurring blocks into individual instances within the date range
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const technicianId = searchParams.get("technicianId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // We need to fetch:
    // 1. Non-recurring blocks within the date range
    // 2. Recurring blocks that might have instances in the date range
    // 3. Modified instance blocks (parentBlockId is set) within the date range

    let baseQuery = supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("isActive", true)
      .is("parentBlockId", null) // Only get parent/original blocks
      .order("startTime", { ascending: true });

    if (technicianId) {
      baseQuery = baseQuery.eq("technicianId", technicianId);
    }

    // For recurring blocks, we need to fetch them all (or those that started before endDate)
    // and then expand them to find instances in our range
    const { data: allBlocks, error } = await baseQuery as { data: BlockData[] | null; error: { message: string } | null };

    if (error) {
      console.error("Fetch technician blocks error:", error);
      return NextResponse.json(
        { error: "Failed to fetch technician blocks", details: error.message },
        { status: 500 }
      );
    }

    // Also fetch any modified instance blocks in the date range
    let modifiedQuery = supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("isActive", true)
      .not("parentBlockId", "is", null);

    if (technicianId) {
      modifiedQuery = modifiedQuery.eq("technicianId", technicianId);
    }

    if (startDate && endDate) {
      modifiedQuery = modifiedQuery
        .gte("startTime", `${startDate}T00:00:00`)
        .lte("startTime", `${endDate}T23:59:59`);
    }

    const { data: modifiedBlocks } = await modifiedQuery as { data: BlockData[] | null; error: { message: string } | null };

    const expandedBlocks: ExpandedBlock[] = [];
    const rangeStart = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
    const rangeEnd = endDate ? endOfDay(parseISO(endDate)) : new Date(2100, 0, 1);

    for (const block of allBlocks || []) {
      if (block.recurrenceRule && block.startTime && block.endTime) {
        // Expand recurring block
        const instances = expandRecurrence(
          block.id,
          parseISO(block.startTime),
          parseISO(block.endTime),
          block.recurrenceRule,
          block.recurrenceExceptions || [],
          rangeStart,
          rangeEnd
        );

        for (const instance of instances) {
          // Check if there's a modified block for this instance
          const modifiedBlock = (modifiedBlocks || []).find(
            (mb) =>
              mb.parentBlockId === block.id &&
              mb.startTime &&
              parseISO(mb.startTime).toDateString() === instance.startTime.toDateString()
          );

          if (modifiedBlock) {
            // Use the modified block instead
            expandedBlocks.push({
              ...modifiedBlock,
              instanceDate: instance.instanceDate,
              isRecurring: true,
            });
          } else {
            // Use the expanded instance from the parent
            expandedBlocks.push({
              ...block,
              startTime: instance.startTime.toISOString(),
              endTime: instance.endTime.toISOString(),
              instanceDate: instance.instanceDate,
              isRecurring: true,
            });
          }
        }
      } else if (block.startTime && block.endTime) {
        // Non-recurring block - check if it's in range
        const blockStart = parseISO(block.startTime);
        const blockEnd = parseISO(block.endTime);

        if (!isAfter(blockStart, rangeEnd) && !isBefore(blockEnd, rangeStart)) {
          expandedBlocks.push({
            ...block,
            isRecurring: false,
          });
        }
      }
    }

    // Sort by start time
    expandedBlocks.sort((a, b) => {
      if (!a.startTime || !b.startTime) return 0;
      return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();
    });

    return NextResponse.json({ blocks: expandedBlocks });
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
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
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
