import { supabase, tables, generateId } from "./supabase";

/**
 * Custom error for appointment conflicts
 */
export class AppointmentConflictError extends Error {
  public conflict: { id: string; startTime: string; endTime: string; clientName: string };

  constructor(
    message: string,
    conflict: { id: string; startTime: string; endTime: string; clientName: string }
  ) {
    super(message);
    this.name = "AppointmentConflictError";
    this.conflict = conflict;
  }
}

/**
 * Custom error for appointment not found
 */
export class AppointmentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentNotFoundError";
  }
}

/**
 * Custom error for stale appointment (optimistic locking failure)
 */
export class AppointmentStaleError extends Error {
  public currentState: unknown;

  constructor(message: string, currentState: unknown) {
    super(message);
    this.name = "AppointmentStaleError";
    this.currentState = currentState;
  }
}

interface ConflictingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  bloom_clients: {
    firstName: string;
    lastName: string;
  } | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  stripeCustomerId: string | null;
  notes: string | null;
  bloom_payment_methods: PaymentMethod[];
}

interface ServiceData {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

interface TechnicianData {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface LocationData {
  id: string;
  name: string;
  city: string;
}

interface AppointmentRow {
  id: string;
  clientId: string;
  technicianId: string;
  locationId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: string;
  updatedAt: string;
}

interface AppointmentWithRelations extends AppointmentRow {
  bloom_clients: ClientData | null;
  bloom_services: ServiceData | null;
  bloom_technicians: TechnicianData | null;
  bloom_locations: LocationData | null;
}

/**
 * Check if a time slot conflicts with existing appointments for a technician
 * Uses row-level locking to prevent race conditions
 */
export async function checkAppointmentConflict({
  technicianId,
  startTime,
  endTime,
  excludeAppointmentId,
}: {
  technicianId: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}): Promise<{ id: string; startTime: string; endTime: string; clientName: string } | null> {
  // Find overlapping appointments
  // Overlap: new.start < existing.end AND new.end > existing.start
  let query = supabase
    .from(tables.appointments)
    .select(`
      id,
      startTime,
      endTime,
      bloom_clients (
        firstName,
        lastName
      )
    `)
    .eq("technicianId", technicianId)
    .not("status", "in", '("CANCELLED","NO_SHOW")')
    .lt("startTime", endTime.toISOString())
    .gt("endTime", startTime.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data: conflicts, error } = await query.limit(1);

  if (error) {
    console.error("Error checking conflicts:", error);
    throw new Error("Failed to check for appointment conflicts");
  }

  if (conflicts && conflicts.length > 0) {
    const conflict = conflicts[0] as unknown as ConflictingAppointment;
    return {
      id: conflict.id,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      clientName: conflict.bloom_clients
        ? `${conflict.bloom_clients.firstName} ${conflict.bloom_clients.lastName}`
        : "Unknown",
    };
  }

  return null;
}

/**
 * Create an appointment with conflict checking
 * Uses PostgreSQL advisory lock for atomic check-and-insert
 */
export async function createAppointmentSafe({
  clientId,
  technicianId,
  locationId,
  serviceId,
  startTime,
  endTime,
  status = "CONFIRMED",
  notes,
  noShowProtected = false,
  bookedBy,
  depositAmount = 0,
}: {
  clientId: string;
  technicianId: string;
  locationId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status?: "PENDING" | "CONFIRMED";
  notes?: string | null;
  noShowProtected?: boolean;
  bookedBy?: string;
  depositAmount?: number;
}) {
  // Use RPC call to create appointment atomically with conflict check
  // This uses PostgreSQL's row-level locking
  // @ts-expect-error - RPC function types not defined in schema
  const { data, error } = await supabase.rpc("create_appointment_safe", {
    p_id: generateId(),
    p_client_id: clientId,
    p_technician_id: technicianId,
    p_location_id: locationId,
    p_service_id: serviceId,
    p_start_time: startTime.toISOString(),
    p_end_time: endTime.toISOString(),
    p_status: status,
    p_notes: notes || null,
    p_no_show_protected: noShowProtected,
    p_booked_by: bookedBy || null,
    p_deposit_amount: depositAmount,
  });

  if (error) {
    // Check if it's a conflict error from our function
    if (error.message?.includes("CONFLICT:")) {
      const conflictInfo = error.message.replace("CONFLICT:", "").trim();
      throw new AppointmentConflictError(
        `Time slot conflicts with existing appointment`,
        JSON.parse(conflictInfo)
      );
    }
    console.error("Error creating appointment:", error);
    throw new Error(error.message || "Failed to create appointment");
  }

  return data;
}

/**
 * Update an appointment with conflict checking and optimistic locking
 */
export async function updateAppointmentSafe({
  appointmentId,
  expectedUpdatedAt,
  data,
}: {
  appointmentId: string;
  expectedUpdatedAt?: string;
  data: {
    technicianId?: string;
    startTime?: Date;
    endTime?: Date;
    status?: string;
    notes?: string;
  };
}) {
  // Use RPC call for atomic update with conflict check
  // @ts-expect-error - RPC function types not defined in schema
  const { data: result, error } = await supabase.rpc("update_appointment_safe", {
    p_appointment_id: appointmentId,
    p_expected_updated_at: expectedUpdatedAt || null,
    p_technician_id: data.technicianId || null,
    p_start_time: data.startTime?.toISOString() || null,
    p_end_time: data.endTime?.toISOString() || null,
    p_status: data.status || null,
    p_notes: data.notes !== undefined ? data.notes : null,
  });

  if (error) {
    if (error.message?.includes("CONFLICT:")) {
      const conflictInfo = error.message.replace("CONFLICT:", "").trim();
      throw new AppointmentConflictError(
        `New time slot conflicts with existing appointment`,
        JSON.parse(conflictInfo)
      );
    }
    if (error.message?.includes("STALE:")) {
      throw new AppointmentStaleError(
        "This appointment was modified by another user. Please refresh and try again.",
        null
      );
    }
    if (error.message?.includes("NOT_FOUND")) {
      throw new AppointmentNotFoundError(`Appointment ${appointmentId} not found`);
    }
    console.error("Error updating appointment:", error);
    throw new Error(error.message || "Failed to update appointment");
  }

  return result;
}

/**
 * Fallback: Create appointment with application-level locking
 * Use this if the RPC functions aren't set up yet
 */
export async function createAppointmentWithCheck({
  clientId,
  technicianId,
  locationId,
  serviceId,
  startTime,
  endTime,
  status = "CONFIRMED",
  notes,
  noShowProtected = false,
  bookedBy,
  depositAmount = 0,
}: {
  clientId: string;
  technicianId: string;
  locationId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status?: "PENDING" | "CONFIRMED";
  notes?: string | null;
  noShowProtected?: boolean;
  bookedBy?: string;
  depositAmount?: number;
}) {
  // Step 1: Check for conflicts
  const conflict = await checkAppointmentConflict({
    technicianId,
    startTime,
    endTime,
  });

  if (conflict) {
    throw new AppointmentConflictError(
      `Time slot conflicts with existing appointment for ${conflict.clientName}`,
      conflict
    );
  }

  // Step 2: Create the appointment
  const appointmentId = generateId();
  const now = new Date().toISOString();

  const { data: appointment, error } = await supabase
    .from(tables.appointments)
    // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
    .insert({
      id: appointmentId,
      clientId,
      technicianId,
      locationId,
      serviceId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status,
      notes: notes || null,
      noShowProtected,
      bookedBy: bookedBy || null,
      depositAmount,
      depositPaidAt: null,
      stripePaymentIntentId: null,
      noShowFeeCharged: false,
      noShowFeeAmount: null,
      noShowChargedAt: null,
      reminder24hSent: false,
      reminder2hSent: false,
      confirmedAt: status === "CONFIRMED" ? now : null,
      cancelledAt: null,
      cancellationReason: null,
      recurringAppointmentId: null,
      createdAt: now,
      updatedAt: now,
    })
    .select(`
      *,
      bloom_clients (
        id,
        firstName,
        lastName,
        phone,
        email,
        phoneVerified,
        stripeCustomerId,
        notes,
        bloom_payment_methods (
          id,
          brand,
          last4,
          isDefault
        )
      ),
      bloom_services (*),
      bloom_technicians (*),
      bloom_locations (*)
    `)
    .single() as { data: AppointmentWithRelations | null; error: { code?: string; message?: string } | null };

  if (error) {
    // Check if it's a constraint violation (database-level protection)
    if (error.code === "23P01" || error.message?.includes("exclusion")) {
      // Re-check for the conflict to get details
      const conflictDetails = await checkAppointmentConflict({
        technicianId,
        startTime,
        endTime,
      });
      throw new AppointmentConflictError(
        "Time slot was just booked by another user",
        conflictDetails || { id: "", startTime: "", endTime: "", clientName: "Unknown" }
      );
    }
    console.error("Error creating appointment:", error);
    throw new Error(error.message || "Failed to create appointment");
  }

  if (!appointment) {
    throw new Error("Failed to create appointment");
  }

  // Transform to expected format
  return {
    ...appointment,
    client: appointment.bloom_clients
      ? {
          ...appointment.bloom_clients,
          paymentMethods: appointment.bloom_clients.bloom_payment_methods || [],
        }
      : null,
    service: appointment.bloom_services || null,
    technician: appointment.bloom_technicians || null,
    location: appointment.bloom_locations || null,
  };
}

/**
 * Update appointment with application-level locking
 */
export async function updateAppointmentWithCheck({
  appointmentId,
  expectedUpdatedAt,
  data,
}: {
  appointmentId: string;
  expectedUpdatedAt?: string;
  data: {
    technicianId?: string;
    startTime?: Date;
    endTime?: Date;
    status?: string;
    notes?: string;
  };
}) {
  // Step 1: Get current appointment
  const { data: current, error: fetchError } = await supabase
    .from(tables.appointments)
    .select("*")
    .eq("id", appointmentId)
    .single() as { data: AppointmentRow | null; error: unknown };

  if (fetchError || !current) {
    throw new AppointmentNotFoundError(`Appointment ${appointmentId} not found`);
  }

  // Step 2: Check optimistic locking
  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = new Date(current.updatedAt).getTime();

    if (Math.abs(actualTime - expectedTime) > 1000) {
      throw new AppointmentStaleError(
        "This appointment was modified by another user. Please refresh and try again.",
        current
      );
    }
  }

  // Step 3: If changing time or tech, check for conflicts
  const newTechnicianId = data.technicianId || current.technicianId;
  const newStartTime = data.startTime || new Date(current.startTime);
  const newEndTime = data.endTime || new Date(current.endTime);

  const timeOrTechChanged =
    data.technicianId !== undefined ||
    data.startTime !== undefined ||
    data.endTime !== undefined;

  if (timeOrTechChanged) {
    const conflict = await checkAppointmentConflict({
      technicianId: newTechnicianId,
      startTime: newStartTime,
      endTime: newEndTime,
      excludeAppointmentId: appointmentId,
    });

    if (conflict) {
      throw new AppointmentConflictError(
        `New time slot conflicts with existing appointment for ${conflict.clientName}`,
        conflict
      );
    }
  }

  // Step 4: Update with optimistic lock check
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.technicianId !== undefined) updateData.technicianId = data.technicianId;
  if (data.startTime !== undefined) updateData.startTime = data.startTime.toISOString();
  if (data.endTime !== undefined) updateData.endTime = data.endTime.toISOString();
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Update with a WHERE on the expected updatedAt
  let updateQuery = supabase
    .from(tables.appointments)
    // @ts-expect-error - Supabase types don't resolve dynamic table names correctly
    .update(updateData)
    .eq("id", appointmentId);

  if (expectedUpdatedAt) {
    updateQuery = updateQuery.eq("updatedAt", current.updatedAt);
  }

  const { data: updated, error: updateError } = await updateQuery
    .select(`
      *,
      bloom_clients (
        *,
        bloom_payment_methods (*)
      ),
      bloom_services (*),
      bloom_technicians (*),
      bloom_locations (*)
    `)
    .single() as { data: AppointmentWithRelations | null; error: { code?: string; message?: string } | null };

  if (updateError) {
    if (updateError.code === "PGRST116") {
      throw new AppointmentStaleError(
        "This appointment was modified by another user. Please refresh and try again.",
        current
      );
    }
    console.error("Error updating appointment:", updateError);
    throw new Error(updateError.message || "Failed to update appointment");
  }

  if (!updated) {
    throw new Error("Failed to update appointment");
  }

  return {
    ...updated,
    client: updated.bloom_clients
      ? {
          ...updated.bloom_clients,
          paymentMethods: updated.bloom_clients.bloom_payment_methods || [],
        }
      : null,
    service: updated.bloom_services || null,
    technician: updated.bloom_technicians || null,
    location: updated.bloom_locations || null,
  };
}
