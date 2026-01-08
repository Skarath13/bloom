import { NextRequest, NextResponse } from "next/server";
import { supabase, tables } from "@/lib/supabase";
import { verifySessionToken, verifyPhoneToken } from "@/lib/session";

// Helper to check if card is expired
function isCardExpired(expiryMonth: number, expiryYear: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expiryYear < currentYear) return true;
  if (expiryYear === currentYear && expiryMonth < currentMonth) return true;
  return false;
}

// GET /api/profile - Get client profile data
export async function GET(request: NextRequest) {
  try {
    // Get session token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Authorization required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Try to verify as a full session token first
    let clientId: string | null = null;
    let phone: string | null = null;

    const session = verifySessionToken(token);
    if (session) {
      clientId = session.clientId;
      phone = session.phone;
    } else {
      // Try phone-only token (for new clients who just verified)
      const phoneSession = verifyPhoneToken(token);
      if (phoneSession) {
        phone = phoneSession.phone;
      }
    }

    if (!phone && !clientId) {
      return NextResponse.json(
        { error: "Invalid or expired session", code: "INVALID_SESSION" },
        { status: 401 }
      );
    }

    // Fetch client data
    let query = supabase
      .from(tables.clients)
      .select(`
        id,
        firstName,
        lastName,
        email,
        phone,
        notes,
        createdAt,
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
      `);

    if (clientId) {
      query = query.eq("id", clientId);
    } else if (phone) {
      query = query.eq("phone", phone);
    }

    const { data: client, error: clientError } = await query.single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Filter expired cards and format
    const paymentMethods = (client.bloom_payment_methods || [])
      .filter((pm: { expiryMonth: number; expiryYear: number }) =>
        !isCardExpired(pm.expiryMonth, pm.expiryYear)
      )
      .sort((a: { isDefault: boolean; createdAt: string }, b: { isDefault: boolean; createdAt: string }) => {
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

    // Fetch appointments
    const { data: appointments } = await supabase
      .from(tables.appointments)
      .select(`
        id,
        startTime,
        endTime,
        status,
        notes,
        inspoImageUrl,
        createdAt,
        bloom_services (
          id,
          name,
          durationMinutes,
          price
        ),
        bloom_technicians (
          id,
          name
        ),
        bloom_locations (
          id,
          name,
          address
        )
      `)
      .eq("clientId", client.id)
      .order("startTime", { ascending: false })
      .limit(50);

    // Format appointments
    const formattedAppointments = (appointments || []).map((apt: {
      id: string;
      startTime: string;
      endTime: string;
      status: string;
      notes: string | null;
      inspoImageUrl: string | null;
      createdAt: string;
      bloom_services: { id: string; name: string; durationMinutes: number; price: number } | null;
      bloom_technicians: { id: string; name: string } | null;
      bloom_locations: { id: string; name: string; address: string } | null;
    }) => ({
      id: apt.id,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      notes: apt.notes,
      inspoImageUrl: apt.inspoImageUrl,
      createdAt: apt.createdAt,
      service: apt.bloom_services ? {
        id: apt.bloom_services.id,
        name: apt.bloom_services.name,
        durationMinutes: apt.bloom_services.durationMinutes,
        price: apt.bloom_services.price,
      } : null,
      technician: apt.bloom_technicians ? {
        id: apt.bloom_technicians.id,
        name: apt.bloom_technicians.name,
      } : null,
      location: apt.bloom_locations ? {
        id: apt.bloom_locations.id,
        name: apt.bloom_locations.name,
        address: apt.bloom_locations.address,
      } : null,
    }));

    return NextResponse.json({
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        createdAt: client.createdAt,
      },
      paymentMethods,
      appointments: formattedAppointments,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// PATCH /api/profile - Update client profile
export async function PATCH(request: NextRequest) {
  try {
    // Get session token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Authorization required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Verify session token
    const session = verifySessionToken(token);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session", code: "INVALID_SESSION" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, notes } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email || null;
    if (notes !== undefined) updateData.notes = notes || null;

    // Update client
    const { data: updatedClient, error: updateError } = await supabase
      .from(tables.clients)
      // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
      .update(updateData)
      .eq("id", session.clientId)
      .select("id, firstName, lastName, email, phone, notes")
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile", code: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update profile", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
