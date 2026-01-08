import { createClient } from "@supabase/supabase-js";
import { createId } from "@paralleldrive/cuid2";

// Recurrence exception type for tracking modified/deleted instances
export interface RecurrenceException {
  date: string; // ISO date string (YYYY-MM-DD)
  type: "deleted" | "modified";
  modifiedBlockId?: string; // ID of the modified block instance
}

// Types for our database tables (in appointments schema)
export interface Database {
  appointments: {
    Tables: {
      bloom_clients: {
        Row: {
          id: string;
          firstName: string;
          lastName: string;
          phone: string;
          phoneVerified: boolean;
          email: string | null;
          notes: string | null;
          isBlocked: boolean;
          blockReason: string | null;
          stripeCustomerId: string | null;
          createdAt: string;
          updatedAt: string;
          lastVisitAt: string | null;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_clients"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_clients"]["Insert"]>;
      };
      bloom_appointments: {
        Row: {
          id: string;
          clientId: string;
          technicianId: string;
          locationId: string;
          serviceId: string;
          startTime: string;
          endTime: string;
          status: string;
          depositAmount: number;
          depositPaidAt: string | null;
          stripePaymentIntentId: string | null;
          noShowProtected: boolean;
          noShowFeeCharged: boolean;
          noShowFeeAmount: number | null;
          noShowChargedAt: string | null;
          reminder24hSent: boolean;
          reminder2hSent: boolean;
          confirmedAt: string | null;
          notes: string | null;
          inspoImageUrl: string | null;
          createdAt: string;
          updatedAt: string;
          cancelledAt: string | null;
          cancellationReason: string | null;
          recurringAppointmentId: string | null;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_appointments"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_appointments"]["Insert"]>;
      };
      bloom_payment_methods: {
        Row: {
          id: string;
          stripePaymentMethodId: string;
          brand: string;
          last4: string;
          expiryMonth: number;
          expiryYear: number;
          isDefault: boolean;
          clientId: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_payment_methods"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_payment_methods"]["Insert"]>;
      };
      bloom_technicians: {
        Row: {
          id: string;
          firstName: string;
          lastName: string;
          description: string | null;
          email: string | null;
          phone: string | null;
          color: string;
          avatarUrl: string | null;
          defaultBufferMinutes: number;
          isActive: boolean;
          sortOrder: number;
          locationId: string;
          hasMasterFee: boolean;
          badges: string[] | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_technicians"]["Row"], "id" | "createdAt" | "updatedAt" | "badges"> & { badges?: string[] | null };
        Update: Partial<Database["appointments"]["Tables"]["bloom_technicians"]["Insert"]>;
      };
      bloom_technician_locations: {
        Row: {
          id: string;
          technicianId: string;
          locationId: string;
          createdAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_technician_locations"]["Row"], "id" | "createdAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_technician_locations"]["Insert"]>;
      };
      bloom_services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          durationMinutes: number;
          price: number;
          depositAmount: number;
          color: string | null;
          imageUrl: string | null;
          isVariablePrice: boolean;
          isActive: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_services"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_services"]["Insert"]>;
      };
      bloom_service_technicians: {
        Row: {
          id: string;
          serviceId: string;
          technicianId: string;
          isEnabled: boolean;
          customDurationMinutes: number | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_service_technicians"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_service_technicians"]["Insert"]>;
      };
      bloom_locations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string;
          city: string;
          state: string;
          zipCode: string;
          phone: string;
          timezone: string;
          operatingHours: Record<string, unknown>;
          isActive: boolean;
          sortOrder: number;
          latitude: number | null;
          longitude: number | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_locations"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_locations"]["Insert"]>;
      };
      bloom_technician_blocks: {
        Row: {
          id: string;
          technicianId: string;
          title: string;
          blockType: string;
          startTime: string | null;
          endTime: string | null;
          recurrenceRule: string | null;
          recurringStart: string | null;
          recurringEnd: string | null;
          recurrenceExceptions: RecurrenceException[];
          parentBlockId: string | null;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_technician_blocks"]["Row"], "id" | "createdAt" | "updatedAt" | "recurrenceExceptions"> & { recurrenceExceptions?: RecurrenceException[] };
        Update: Partial<Database["appointments"]["Tables"]["bloom_technician_blocks"]["Insert"]>;
      };
      bloom_appointment_line_items: {
        Row: {
          id: string;
          appointmentId: string;
          itemType: string;
          serviceId: string | null;
          productId: string | null;
          name: string;
          quantity: number;
          unitPrice: number;
          discountAmount: number;
          totalAmount: number;
          notes: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_appointment_line_items"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_appointment_line_items"]["Insert"]>;
      };
      bloom_recurring_appointments: {
        Row: {
          id: string;
          appointmentId: string;
          clientId: string;
          technicianId: string;
          locationId: string;
          serviceId: string;
          recurrencePattern: string;
          dayOfWeek: number;
          preferredTime: string;
          startDate: string;
          endDate: string | null;
          occurrences: number | null;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_recurring_appointments"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_recurring_appointments"]["Insert"]>;
      };
      bloom_products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          sku: string | null;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database["appointments"]["Tables"]["bloom_products"]["Row"], "id" | "createdAt" | "updatedAt">;
        Update: Partial<Database["appointments"]["Tables"]["bloom_products"]["Insert"]>;
      };
    };
  };
}

// Get Supabase URL and key from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase environment variables not set. Using placeholder values for build.");
}

// Create the Supabase client
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    db: {
      schema: "appointments",
    },
  }
);

// Generate cryptographically secure unique IDs using cuid2
// These are collision-resistant, URL-safe, and sortable
export function generateId(): string {
  return createId();
}

// Table name helpers for the appointments schema
export const tables = {
  clients: "bloom_clients",
  appointments: "bloom_appointments",
  appointmentLineItems: "bloom_appointment_line_items",
  paymentMethods: "bloom_payment_methods",
  technicians: "bloom_technicians",
  technicianLocations: "bloom_technician_locations",
  services: "bloom_services",
  products: "bloom_products",
  locations: "bloom_locations",
  technicianBlocks: "bloom_technician_blocks",
  technicianSchedules: "bloom_technician_schedules",
  serviceLocations: "bloom_service_locations",
  serviceTechnicians: "bloom_service_technicians",
  users: "bloom_users",
  phoneVerifications: "bloom_phone_verifications",
  recurringAppointments: "bloom_recurring_appointments",
  waitlistEntries: "bloom_waitlist_entries",
} as const;
