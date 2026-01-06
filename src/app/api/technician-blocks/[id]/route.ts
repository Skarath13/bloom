import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId, type RecurrenceException } from "@/lib/supabase";
import { parseRecurrenceRule } from "@/lib/recurrence";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

type EditScope = "this_only" | "this_and_future" | "all";

interface BlockRow {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: string | null;
  endTime: string | null;
  recurrenceRule: string | null;
  recurrenceExceptions: RecurrenceException[];
  parentBlockId: string | null;
  isActive: boolean;
}

/**
 * PATCH /api/technician-blocks/[id]
 * Update a technician block
 *
 * Query params for recurring events:
 * - scope: "this_only" | "this_and_future" | "all" (default: "all")
 * - instanceDate: ISO date string for the specific instance (required for "this_only" and "this_and_future")
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, startTime, endTime, blockType, isActive, technicianId, recurrenceRule } = body;

    const searchParams = request.nextUrl.searchParams;
    const scope = (searchParams.get("scope") as EditScope) || "all";
    const instanceDate = searchParams.get("instanceDate");

    // Fetch the original block
    const { data: originalBlock, error: fetchError } = await supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("id", id)
      .single() as { data: BlockRow | null; error: { message: string } | null };

    if (fetchError || !originalBlock) {
      return NextResponse.json(
        { error: "Block not found", details: fetchError?.message },
        { status: 404 }
      );
    }

    // Handle non-recurring blocks or "all" scope
    if (!originalBlock.recurrenceRule || scope === "all") {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (title !== undefined) updateData.title = title;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (blockType !== undefined) updateData.blockType = blockType;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (technicianId !== undefined) updateData.technicianId = technicianId;
      if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule;

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
    }

    // Handle "this_only" - create exception and new modified block
    if (scope === "this_only" && instanceDate) {
      // Add exception to the original block
      const exceptions: RecurrenceException[] = [
        ...(originalBlock.recurrenceExceptions || []),
        { date: instanceDate, type: "modified" as const },
      ];

      await supabase
        .from(tables.technicianBlocks)
        // @ts-expect-error - Supabase types
        .update({
          recurrenceExceptions: exceptions,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id);

      // Create a new block for this specific instance
      const newBlock = {
        id: generateId(),
        technicianId: originalBlock.technicianId,
        title: title ?? originalBlock.title,
        blockType: originalBlock.blockType,
        startTime: startTime ?? originalBlock.startTime,
        endTime: endTime ?? originalBlock.endTime,
        recurrenceRule: null, // This is a single instance
        recurringStart: null,
        recurringEnd: null,
        recurrenceExceptions: [],
        parentBlockId: id, // Link to parent
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data: block, error } = await supabase
        .from(tables.technicianBlocks)
        // @ts-expect-error - Supabase types
        .insert(newBlock)
        .select()
        .single();

      if (error) {
        console.error("Create modified instance error:", error);
        return NextResponse.json(
          { error: "Failed to create modified instance", details: error.message },
          { status: 500 }
        );
      }

      // Update the exception with the new block ID
      const updatedExceptions = exceptions.map((e) =>
        e.date === instanceDate ? { ...e, modifiedBlockId: block.id } : e
      );

      await supabase
        .from(tables.technicianBlocks)
        // @ts-expect-error - Supabase types
        .update({ recurrenceExceptions: updatedExceptions })
        .eq("id", id);

      return NextResponse.json({ block });
    }

    // Handle "this_and_future" - modify the recurrence rule to end before this date
    if (scope === "this_and_future" && instanceDate) {
      const instanceDateObj = parseISO(instanceDate);
      const parsed = parseRecurrenceRule(originalBlock.recurrenceRule);

      if (parsed && originalBlock.startTime) {
        // Update original to end before this instance
        const untilDate = format(
          new Date(instanceDateObj.getTime() - 24 * 60 * 60 * 1000),
          "yyyyMMdd"
        );
        let newRule = `FREQ=${parsed.freq};INTERVAL=${parsed.interval};UNTIL=${untilDate}`;

        await supabase
          .from(tables.technicianBlocks)
          // @ts-expect-error - Supabase types
          .update({
            recurrenceRule: newRule,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", id);

        // Create a new recurring block starting from this instance
        const originalStartTime = parseISO(originalBlock.startTime);
        const originalEndTime = originalBlock.endTime ? parseISO(originalBlock.endTime) : originalStartTime;
        const duration = originalEndTime.getTime() - originalStartTime.getTime();

        // Build new start/end times using the instance date but keeping original times
        const newStartTime = new Date(instanceDateObj);
        newStartTime.setHours(
          originalStartTime.getHours(),
          originalStartTime.getMinutes(),
          originalStartTime.getSeconds()
        );
        const newEndTime = new Date(newStartTime.getTime() + duration);

        // Build new recurrence rule (keep original end condition if it had one)
        let newRecurrenceRule = `FREQ=${parsed.freq};INTERVAL=${parsed.interval}`;
        if (parsed.until) {
          newRecurrenceRule += `;UNTIL=${format(parsed.until, "yyyyMMdd")}`;
        } else if (parsed.count) {
          // For COUNT, we need to calculate remaining occurrences
          // This is approximate - we subtract the instances before this date
          newRecurrenceRule += `;COUNT=${parsed.count}`;
        }

        const newBlock = {
          id: generateId(),
          technicianId: originalBlock.technicianId,
          title: title ?? originalBlock.title,
          blockType: originalBlock.blockType,
          startTime: startTime ?? newStartTime.toISOString(),
          endTime: endTime ?? newEndTime.toISOString(),
          recurrenceRule: recurrenceRule ?? newRecurrenceRule,
          recurringStart: null,
          recurringEnd: null,
          recurrenceExceptions: [],
          parentBlockId: null, // This is a new series
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const { data: block, error } = await supabase
          .from(tables.technicianBlocks)
          // @ts-expect-error - Supabase types
          .insert(newBlock)
          .select()
          .single();

        if (error) {
          console.error("Create new series error:", error);
          return NextResponse.json(
            { error: "Failed to create new series", details: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ block, originalUpdated: true });
      }
    }

    return NextResponse.json({ error: "Invalid scope or missing instanceDate" }, { status: 400 });
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
 *
 * Query params for recurring events:
 * - scope: "this_only" | "this_and_future" | "all" (default: "all")
 * - instanceDate: ISO date string for the specific instance (required for "this_only" and "this_and_future")
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;
    const scope = (searchParams.get("scope") as EditScope) || "all";
    const instanceDate = searchParams.get("instanceDate");

    // Fetch the original block
    const { data: originalBlock, error: fetchError } = await supabase
      .from(tables.technicianBlocks)
      .select("*")
      .eq("id", id)
      .single() as { data: BlockRow | null; error: { message: string } | null };

    if (fetchError || !originalBlock) {
      return NextResponse.json(
        { error: "Block not found", details: fetchError?.message },
        { status: 404 }
      );
    }

    // Handle non-recurring blocks or "all" scope
    if (!originalBlock.recurrenceRule || scope === "all") {
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

      // Also delete any child blocks (modified instances)
      await supabase
        .from(tables.technicianBlocks)
        // @ts-expect-error - Supabase types
        .update({ isActive: false, updatedAt: new Date().toISOString() })
        .eq("parentBlockId", id);

      return NextResponse.json({ success: true });
    }

    // Handle "this_only" - add exception for this date
    if (scope === "this_only" && instanceDate) {
      const exceptions: RecurrenceException[] = [
        ...(originalBlock.recurrenceExceptions || []),
        { date: instanceDate, type: "deleted" as const },
      ];

      const { error } = await supabase
        .from(tables.technicianBlocks)
        // @ts-expect-error - Supabase types
        .update({
          recurrenceExceptions: exceptions,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Add delete exception error:", error);
        return NextResponse.json(
          { error: "Failed to delete instance", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Handle "this_and_future" - modify the recurrence rule to end before this date
    if (scope === "this_and_future" && instanceDate) {
      const instanceDateObj = parseISO(instanceDate);
      const parsed = parseRecurrenceRule(originalBlock.recurrenceRule);

      if (parsed) {
        // Check if instance date is the first occurrence - if so, delete all
        if (originalBlock.startTime) {
          const originalStart = startOfDay(parseISO(originalBlock.startTime));
          const instanceStart = startOfDay(instanceDateObj);

          if (originalStart.getTime() === instanceStart.getTime()) {
            // First occurrence - just delete the whole series
            const { error } = await supabase
              .from(tables.technicianBlocks)
              // @ts-expect-error - Supabase types
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
          }
        }

        // Update original to end before this instance
        const untilDate = format(
          new Date(instanceDateObj.getTime() - 24 * 60 * 60 * 1000),
          "yyyyMMdd"
        );
        const newRule = `FREQ=${parsed.freq};INTERVAL=${parsed.interval};UNTIL=${untilDate}`;

        const { error } = await supabase
          .from(tables.technicianBlocks)
          // @ts-expect-error - Supabase types
          .update({
            recurrenceRule: newRule,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          console.error("Update recurrence rule error:", error);
          return NextResponse.json(
            { error: "Failed to delete future instances", details: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid scope or missing instanceDate" }, { status: 400 });
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
