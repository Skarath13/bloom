import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/clients/search
 * Search clients by name or phone
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ clients: [] });
    }

    // Normalize the query - remove non-alphanumeric for phone matching
    const phoneQuery = query.replace(/\D/g, "");

    // Search by name or phone
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
          // Search by phone if query looks like a number
          ...(phoneQuery.length >= 3
            ? [
                {
                  phone: {
                    contains: phoneQuery,
                  },
                },
              ]
            : []),
        ],
      },
      take: 20,
      orderBy: { lastName: "asc" },
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
    console.error("Search clients error:", error);
    return NextResponse.json(
      { error: "Failed to search clients" },
      { status: 500 }
    );
  }
}
