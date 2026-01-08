import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { timingSafeEqual } from "crypto";
import { createSessionToken, createPhoneVerifiedToken } from "@/lib/session";

// Failed attempt tracking
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Timing-safe string comparison
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

// Check if card is expired
function isCardExpired(expiryMonth: number, expiryYear: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  if (expiryYear < currentYear) return true;
  if (expiryYear === currentYear && expiryMonth < currentMonth) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Phone number and code are required", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    // Check for lockout due to too many failed attempts
    const lockoutCutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
    const { count: failedAttempts } = await supabase
      .from(tables.phoneVerifications)
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .eq("verified", false)
      .gte("createdAt", lockoutCutoff.toISOString());

    if ((failedAttempts || 0) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Please try again later.",
          code: "TOO_MANY_ATTEMPTS",
          retryAfter: LOCKOUT_MINUTES * 60,
        },
        { status: 429 }
      );
    }

    // Find the most recent unverified, non-expired verification record
    const { data: verification } = await supabase
      .from(tables.phoneVerifications)
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("verified", false)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return NextResponse.json(
        { error: "No pending verification found. Please request a new code.", code: "NO_PENDING_VERIFICATION" },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (new Date(verification.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one.", code: "EXPIRED_CODE" },
        { status: 400 }
      );
    }

    // Timing-safe code comparison
    if (!secureCompare(code.toString(), verification.code)) {
      // Calculate remaining attempts
      const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - (failedAttempts || 0) - 1);

      return NextResponse.json(
        {
          error: "Incorrect verification code.",
          code: "INVALID_CODE",
          attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // Mark as verified
    await supabase
      .from(tables.phoneVerifications)
      .update({ verified: true })
      .eq("id", verification.id);

    // Update client phone verified status if client exists
    await supabase
      .from(tables.clients)
      .update({ phoneVerified: true, updatedAt: new Date().toISOString() })
      .eq("phone", normalizedPhone);

    // Fetch client data with payment methods
    const { data: client } = await supabase
      .from(tables.clients)
      .select(`
        id,
        firstName,
        lastName,
        email,
        notes,
        bloom_payment_methods (
          id,
          stripePaymentMethodId,
          brand,
          last4,
          expiryMonth,
          expiryYear,
          isDefault,
          createdAt
        )
      `)
      .eq("phone", normalizedPhone)
      .single();

    // If no client exists, return success with null client and phone-only token
    if (!client) {
      const sessionToken = createPhoneVerifiedToken(normalizedPhone);
      return NextResponse.json({
        success: true,
        message: "Phone number verified successfully",
        client: null,
        sessionToken,
      });
    }

    // Filter out expired cards and format payment methods
    const paymentMethods = (client.bloom_payment_methods || [])
      .filter((pm: { expiryMonth: number; expiryYear: number }) => !isCardExpired(pm.expiryMonth, pm.expiryYear))
      .sort((a: { isDefault: boolean; createdAt: string }, b: { isDefault: boolean; createdAt: string }) => {
        // Default card first, then by most recent
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .map((pm: {
        id: string;
        stripePaymentMethodId: string;
        brand: string;
        last4: string;
        expiryMonth: number;
        expiryYear: number;
        isDefault: boolean;
      }) => ({
        id: pm.id,
        stripePaymentMethodId: pm.stripePaymentMethodId,
        brand: pm.brand,
        last4: pm.last4,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        isDefault: pm.isDefault,
      }));

    // Create session token for authenticated access
    const sessionToken = createSessionToken(client.id, normalizedPhone);

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        notes: client.notes,
        paymentMethods,
      },
      sessionToken,
    });
  } catch (error) {
    console.error("Verify confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to verify code", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
