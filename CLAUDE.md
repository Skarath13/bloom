# Bloom Booking System - Project Instructions

## Database

- **Database**: Supabase PostgreSQL
- **Schema**: All tables are in the `appointments` schema (NOT public)
- **ORM Migration**: Migrating from Prisma to native Supabase JS client
  - Current: Using Prisma ORM (legacy)
  - Target: Native `@supabase/supabase-js` client
  - Reason: Better integration, simpler setup, direct access to Supabase features
  - Status: Supabase client set up at `src/lib/supabase.ts`

### Migration Pattern

When migrating an API route from Prisma to Supabase:

```typescript
// OLD (Prisma)
import prisma from "@/lib/prisma";
const client = await prisma.client.findUnique({
  where: { id: clientId },
  include: { paymentMethods: true },
});

// NEW (Supabase)
import { supabase, tables, generateId } from "@/lib/supabase";

const { data: client, error } = await supabase
  .from(tables.clients)
  .select("*, bloom_payment_methods(*)")
  .eq("id", clientId)
  .single();

if (error) throw error;
```

### Key Differences
- Supabase uses `.from(tableName)` instead of `prisma.modelName`
- All table names are prefixed with `bloom_` and in `appointments` schema
- Use `generateId()` for new records (maintains Prisma CUID format)
- Foreign key relations use the actual table name in select: `bloom_payment_methods(*)`
- Always check for errors: `if (error) throw error;`

### Realtime Enabled Tables
The following tables have Supabase Realtime enabled:
- `bloom_appointments` - Calendar auto-updates when appointments change
- `bloom_technician_blocks` - Calendar auto-updates when blocks change
- `bloom_clients` - Client data syncs in real-time

Use the `useRealtimeAppointments` hook in `src/hooks/use-realtime-appointments.ts` for subscribing to changes.

### Table Naming Convention
All tables are prefixed with `bloom_` and located in the `appointments` schema:
- `appointments.bloom_clients`
- `appointments.bloom_appointments`
- `appointments.bloom_technicians`
- `appointments.bloom_locations`
- `appointments.bloom_services`
- `appointments.bloom_payment_methods`
- etc.

### Database Connection
- Project ID: `ohhgcmdurcviweoillpc`
- Using connection pooler (pgbouncer) for serverless

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase PostgreSQL (appointments schema)
- **Payments**: Stripe (Setup Intents for card-on-file, Payment Intents for charging)
- **SMS**: Twilio (reminders, verification)
- **UI**: Tailwind CSS + shadcn/ui
- **Calendar**: Custom-built (CSS Grid + dnd-kit)

## Key Features

### Card-on-File System
- Cards are saved via Stripe Setup Intents (not charged at booking)
- No-show protection: card can be charged if client no-shows or cancels within 6 hours
- Cards are reusable for future appointments
- Admin can manually charge fees from appointment dialog

### Stripe Integration
- `src/lib/stripe.ts` - Server-side Stripe utilities
- `src/lib/stripe-client.ts` - Client-side Stripe loader
- Setup Intents for saving cards
- Payment Intents for off-session charging

## Environment Variables

```
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WEBHOOK_URL=https://[your-domain]/api/webhooks/twilio
```

## TODO: Twilio Webhook Setup

Configure incoming SMS webhook in Twilio Console:
1. Go to https://console.twilio.com
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Under "Messaging Configuration":
   - Set "A message comes in" webhook URL to: `https://[your-domain]/api/webhooks/twilio`
   - Method: POST
5. Save changes

This enables clients to confirm appointments by replying "C", "confirm", "yes", etc.

## TODO: Database Data Setup

For the booking flow to work, the following tables need data:

- [ ] **bloom_locations** - At least one active location
  - Required fields: `name`, `slug`, `address`, `city`, `state`, `zipCode`, `isActive=true`
  - The `slug` is used in URLs (e.g., "irvine", "tustin")

- [ ] **bloom_services** - Services offered
  - Required fields: `name`, `category`, `durationMinutes`, `price`, `depositAmount`, `isActive=true`
  - Categories group services in the booking UI (e.g., "Lash Extensions", "Lash Fills")

- [ ] **bloom_service_locations** - Link services to locations
  - Junction table: `serviceId`, `locationId`
  - Each service must be linked to at least one location to appear in booking

- [ ] **bloom_technicians** - Technicians/staff
  - Required fields: `firstName`, `lastName`, `color`, `isActive=true`

- [ ] **bloom_technician_locations** - Link technicians to locations
  - Junction table: `technicianId`, `locationId`
  - Each technician must be linked to at least one location

- [ ] **bloom_technician_schedules** - Working hours
  - Required for each technician: 7 rows (one per day of week 0-6)
  - Fields: `technicianId`, `dayOfWeek`, `startTime`, `endTime`, `isWorking`
  - Example: `dayOfWeek=1, startTime="09:00", endTime="19:00", isWorking=true`

## API Routes

### Booking
- `POST /api/booking/create` - Create appointment + Setup Intent
- `POST /api/booking/confirm` - Confirm booking after card saved

### Clients
- `POST /api/clients/[id]/setup-intent` - Create new Setup Intent
- `GET/POST/DELETE /api/clients/[id]/payment-methods` - Manage saved cards

### Appointments
- `GET /api/appointments` - List appointments with filters
- `POST /api/appointments/[id]/charge` - Charge no-show fee

## Brand Colors

```css
--navy-primary: #1E1B4B;
--dusty-rose: #8B687A;
--blush-pink-light: #FDF2F2;
--blush-pink: #F5D0D0;
--blush-peach: #EDCAC9;
```
