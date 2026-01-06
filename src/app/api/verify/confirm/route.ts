import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Phone number and code are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, "");

    // Find the verification record
    const { data: verification } = await supabase
      .from(tables.phoneVerifications)
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
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

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (error) {
    console.error("Verify confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
