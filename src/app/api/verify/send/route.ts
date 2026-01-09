import { NextRequest, NextResponse } from "next/server";
import { supabase, tables, generateId } from "@/lib/supabase";
import { generateVerificationCode, sendVerificationCode, lookupPhoneType } from "@/lib/twilio";
import { addMinutes } from "date-fns";

// Rate limiting: max 10 requests per phone per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_REQUESTS_PER_WINDOW = 10;

// IP-based rate limiting: max 20 requests per IP per hour (prevents cycling through phones)
const MAX_REQUESTS_PER_IP = 20;

// In-memory IP rate limit store (resets on server restart - use Redis in production for persistence)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP (handles proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  // Fallback - may not be accurate behind proxies
  return "unknown";
}

function checkIPRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetTime) {
    // New window
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_IP) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    // Check IP-based rate limit first (prevents SMS pumping attacks)
    const clientIP = getClientIP(request);
    const ipCheck = checkIPRateLimit(clientIP);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          code: "IP_RATE_LIMITED",
          retryAfter: ipCheck.retryAfter,
        },
        { status: 429 }
      );
    }

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

    // Carrier lookup to validate phone type (reject landlines)
    const phoneInfo = await lookupPhoneType(normalizedPhone);
    if (phoneInfo.type === "landline") {
      return NextResponse.json(
        {
          error: "Please use a mobile phone number. Landlines cannot receive SMS.",
          code: "LANDLINE_NOT_SUPPORTED",
        },
        { status: 400 }
      );
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
