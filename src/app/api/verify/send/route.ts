import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import { generateVerificationCode, sendVerificationCode } from "@/lib/twilio";
import { addMinutes } from "date-fns";

// Rate limiting: max 10 requests per phone per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_REQUESTS_PER_WINDOW = 10;

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
    const { data: recentVerifications, count: recentAttempts } = await supabase
      .from(tables.phoneVerifications)
      .select("createdAt", { count: "exact" })
      .eq("phone", normalizedPhone)
      .gte("createdAt", windowStart.toISOString())
      .order("createdAt", { ascending: true });

    const currentAttempts = recentAttempts || 0;
    const remainingAttempts = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentAttempts - 1);

    if (currentAttempts >= MAX_REQUESTS_PER_WINDOW) {
      // Calculate when the oldest verification in the window will expire
      const oldestInWindow = recentVerifications?.[0]?.createdAt;
      const nextAttemptAt = oldestInWindow
        ? addMinutes(new Date(oldestInWindow), RATE_LIMIT_WINDOW_MINUTES)
        : addMinutes(new Date(), RATE_LIMIT_WINDOW_MINUTES);

      return NextResponse.json(
        {
          error: "Too many verification attempts. Please try again later.",
          nextAttemptAt: nextAttemptAt.toISOString(),
          remainingAttempts: 0,
        },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = addMinutes(new Date(), 10); // Code expires in 10 minutes

    // Invalidate any existing codes for this phone
    await supabase
      .from(tables.phoneVerifications)
      .update({ verified: true })
      .eq("phone", normalizedPhone)
      .eq("verified", false);

    // Create new verification record
    const { error: createError } = await supabase
      .from(tables.phoneVerifications)
      .insert({
        id: generateId(),
        phone: normalizedPhone,
        code,
        expiresAt: expiresAt.toISOString(),
        verified: false,
        createdAt: new Date().toISOString(),
      });

    if (createError) throw createError;

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
      expiresAt: expiresAt.toISOString(),
      remainingAttempts,
    });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
