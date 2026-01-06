import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";

interface LineItem {
  id: string;
  appointmentId: string;
  itemType: "service" | "product" | "discount";
  serviceId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/appointments/[id]/line-items
 * Get all line items for an appointment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;

    // Try to fetch line items - table may not exist yet
    const { data: lineItems, error } = await supabase
      .from(tables.appointmentLineItems)
      .select("*")
      .eq("appointmentId", appointmentId)
      .order("createdAt", { ascending: true });

    if (error) {
      // If table doesn't exist or relation error, just return empty array
      // This is expected in development if the table hasn't been created
      console.warn("Line items fetch issue (table may not exist):", error.message);
      return NextResponse.json({ lineItems: [] });
    }

    return NextResponse.json({ lineItems: lineItems || [] });
  } catch (error) {
    console.error("Get line items error:", error);
    // Return empty array instead of 500 error for better UX
    return NextResponse.json({ lineItems: [] });
  }
}

/**
 * POST /api/appointments/[id]/line-items
 * Add a line item to an appointment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const body = await request.json();

    const {
      itemType,
      serviceId,
      productId,
      name,
      quantity = 1,
      unitPrice,
      discountAmount = 0,
      notes,
    } = body;

    // Validate required fields
    if (!itemType || !name) {
      return NextResponse.json(
        { error: "itemType and name are required" },
        { status: 400 }
      );
    }

    // If adding a service, fetch service details
    let serviceName = name;
    let servicePrice = unitPrice;
    if (itemType === "service" && serviceId) {
      const { data: service } = await supabase
        .from(tables.services)
        .select("name, price")
        .eq("id", serviceId)
        .single() as { data: { name: string; price: number } | null; error: unknown };

      if (service) {
        serviceName = service.name;
        servicePrice = service.price;
      }
    }

    // If adding a product, fetch product details
    if (itemType === "product" && productId) {
      const { data: product } = await supabase
        .from(tables.products)
        .select("name, price")
        .eq("id", productId)
        .single() as { data: { name: string; price: number } | null; error: unknown };

      if (product) {
        serviceName = product.name;
        servicePrice = product.price;
      }
    }

    // Calculate total
    const finalUnitPrice = servicePrice ?? unitPrice ?? 0;
    const totalAmount = (finalUnitPrice * quantity) - discountAmount;

    const lineItem: Partial<LineItem> = {
      id: generateId(),
      appointmentId,
      itemType,
      serviceId: serviceId || null,
      productId: productId || null,
      name: serviceName,
      quantity,
      unitPrice: finalUnitPrice,
      discountAmount,
      totalAmount,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: newLineItem, error } = await supabase
      .from(tables.appointmentLineItems)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .insert(lineItem)
      .select()
      .single() as { data: LineItem | null; error: unknown };

    if (error) {
      console.error("Failed to create line item:", error);
      return NextResponse.json(
        { error: "Failed to add line item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ lineItem: newLineItem }, { status: 201 });
  } catch (error) {
    console.error("Create line item error:", error);
    return NextResponse.json(
      { error: "Failed to add line item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/appointments/[id]/line-items
 * Delete a line item from an appointment (expects lineItemId in body)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const body = await request.json();
    const { lineItemId } = body;

    if (!lineItemId) {
      return NextResponse.json(
        { error: "lineItemId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from(tables.appointmentLineItems)
      .delete()
      .eq("id", lineItemId)
      .eq("appointmentId", appointmentId);

    if (error) {
      console.error("Failed to delete line item:", error);
      return NextResponse.json(
        { error: "Failed to delete line item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete line item error:", error);
    return NextResponse.json(
      { error: "Failed to delete line item" },
      { status: 500 }
    );
  }
}
