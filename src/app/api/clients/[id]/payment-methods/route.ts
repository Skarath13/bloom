import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getPaymentMethodDetails,
  listCustomerPaymentMethods,
  detachPaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/stripe";

/**
 * GET /api/clients/[id]/payment-methods
 * List all saved payment methods for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    // Get client with payment methods
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        paymentMethods: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      paymentMethods: client.paymentMethods,
      hasCardOnFile: client.paymentMethods.length > 0,
    });
  } catch (error) {
    console.error("List payment methods error:", error);
    return NextResponse.json(
      { error: "Failed to list payment methods" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/payment-methods
 * Save a new payment method after Setup Intent completes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { paymentMethodId, setAsDefault } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 }
      );
    }

    // Get client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { paymentMethods: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client has no Stripe customer" },
        { status: 400 }
      );
    }

    // Get payment method details from Stripe
    const pmDetails = await getPaymentMethodDetails(paymentMethodId);

    // Check if already saved
    const existingPm = await prisma.paymentMethod.findUnique({
      where: { stripePaymentMethodId: paymentMethodId },
    });

    if (existingPm) {
      return NextResponse.json({
        paymentMethod: existingPm,
        message: "Payment method already saved",
      });
    }

    // If setting as default or first card, update other cards
    const isFirstCard = client.paymentMethods.length === 0;
    const shouldBeDefault = setAsDefault || isFirstCard;

    if (shouldBeDefault) {
      // Unset other defaults
      await prisma.paymentMethod.updateMany({
        where: { clientId, isDefault: true },
        data: { isDefault: false },
      });

      // Set as default in Stripe too
      await setDefaultPaymentMethod(client.stripeCustomerId, paymentMethodId);
    }

    // Save to database
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        clientId,
        stripePaymentMethodId: paymentMethodId,
        brand: pmDetails.brand,
        last4: pmDetails.last4,
        expiryMonth: pmDetails.expiryMonth,
        expiryYear: pmDetails.expiryYear,
        isDefault: shouldBeDefault,
      },
    });

    return NextResponse.json({ paymentMethod });
  } catch (error) {
    console.error("Save payment method error:", error);
    return NextResponse.json(
      { error: "Failed to save payment method" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/payment-methods
 * Remove a saved payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("paymentMethodId");

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method ID is required" },
        { status: 400 }
      );
    }

    // Get payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        clientId,
        stripePaymentMethodId: paymentMethodId,
      },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    // Detach from Stripe
    await detachPaymentMethod(paymentMethodId);

    // Delete from database
    await prisma.paymentMethod.delete({
      where: { id: paymentMethod.id },
    });

    // If this was the default, set another card as default
    if (paymentMethod.isDefault) {
      const otherCard = await prisma.paymentMethod.findFirst({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      });

      if (otherCard) {
        await prisma.paymentMethod.update({
          where: { id: otherCard.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete payment method error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment method" },
      { status: 500 }
    );
  }
}
