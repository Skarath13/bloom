import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateVerificationCode, sendVerificationCode } from "@/lib/twilio";
import { addMinutes } from "date-fns";

// Rate limiting: max 3 requests per phone per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_REQUESTS_PER_WINDOW = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    if (normalizedPhone.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // Check rate limit
    const windowStart = addMinutes(new Date(), -RATE_LIMIT_WINDOW_MINUTES);
    const recentAttempts = await prisma.phoneVerification.count({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: windowStart },
      },
    });

    if (recentAttempts >= MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = addMinutes(new Date(), 10); // Code expires in 10 minutes

    // Invalidate any existing codes for this phone
    await prisma.phoneVerification.updateMany({
      where: {
        phone: normalizedPhone,
        verified: false,
      },
      data: {
        verified: true, // Mark as used so they can't be used again
      },
    });

    // Create new verification record
    await prisma.phoneVerification.create({
      data: {
        phone: normalizedPhone,
        code,
        expiresAt,
      },
    });

    // Send SMS
    const result = await sendVerificationCode(normalizedPhone, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send verification code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
