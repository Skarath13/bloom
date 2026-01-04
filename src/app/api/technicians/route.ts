import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const where: Record<string, unknown> = {};

    if (locationId) {
      where.locationId = locationId;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    const technicians = await prisma.technician.findMany({
      where,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        schedules: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json({ technicians });
  } catch (error) {
    console.error("Fetch technicians error:", error);
    return NextResponse.json(
      { error: "Failed to fetch technicians" },
      { status: 500 }
    );
  }
}
