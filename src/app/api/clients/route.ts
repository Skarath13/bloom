import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/clients
 * List all clients with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    const clients = await prisma.client.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        paymentMethods: {
          select: {
            id: true,
            brand: true,
            last4: true,
            isDefault: true,
          },
          orderBy: { isDefault: "desc" },
        },
      },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("List clients error:", error);
    return NextResponse.json(
      { error: "Failed to list clients" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, phone, email } = body;

    // Validate required fields
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: "First name, last name, and phone are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    // Check if client with this phone already exists
    const existingClient = await prisma.client.findUnique({
      where: { phone: normalizedPhone },
      include: {
        paymentMethods: {
          select: {
            id: true,
            brand: true,
            last4: true,
            isDefault: true,
          },
        },
      },
    });

    if (existingClient) {
      return NextResponse.json({
        client: existingClient,
        message: "Client already exists with this phone number",
        existing: true,
      });
    }

    // Create new client
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        phone: normalizedPhone,
        email: email || null,
        phoneVerified: false,
      },
      include: {
        paymentMethods: {
          select: {
            id: true,
            brand: true,
            last4: true,
            isDefault: true,
          },
        },
      },
    });

    return NextResponse.json({
      client,
      message: "Client created successfully",
      existing: false,
    });
  } catch (error) {
    console.error("Create client error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
