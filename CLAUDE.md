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

## TODO: Stripe Setup

Configure Stripe for payment processing:

1. [ ] Create/login to Stripe account at https://dashboard.stripe.com
2. [ ] Get test API keys from https://dashboard.stripe.com/test/apikeys
3. [ ] Update `.env.local` with:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
4. [ ] Restart dev server after adding keys
5. [ ] Test booking flow end-to-end with test card: `4242 4242 4242 4242`
6. [ ] (Production) Set up webhook endpoint at `/api/webhooks/stripe`
7. [ ] (Production) Switch to live keys when ready

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

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

## Database Data Setup (Completed)

All required tables have been populated:

- [x] **bloom_locations** - 5 active locations (Irvine, Tustin, Santa Ana, Costa Mesa, Newport Beach)
- [x] **bloom_services** - 48 services configured
- [x] **bloom_service_locations** - 240 service-location links (all services linked to all locations)
- [x] **bloom_technicians** - 29 technicians configured
- [x] **bloom_technician_locations** - 29 technician-location links
- [x] **bloom_technician_schedules** - All technicians have 7-day schedules configured

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

## Responsive Design: Desktop vs Mobile

### Detection
- Mobile detection via `useIsMobile()` hook at `src/hooks/use-is-mobile.ts`
- Breakpoint: `768px` (below = mobile, above = desktop)
- Calendar page uses conditional rendering based on `config.isMobile`

### Desktop View
- Full sidebar navigation (`AdminSidebar`)
- Resource calendar with drag-and-drop support (dnd-kit)
- Multi-column technician view
- Hover states and tooltips

### Mobile View (PWA)
- **Target Device**: iPhone 14 Pro Max (430×932 viewport)
- **Mode**: Progressive Web App (standalone via Safari "Add to Home Screen")
- Bottom tab navigation (persistent across all admin pages)
- Full-screen sheet modals instead of dialogs
- Touch-optimized with 44×44pt minimum tap targets
- No drag-and-drop (tap-to-create only)

### Mobile Components (`src/components/calendar/mobile/`)

| Component | Purpose |
|-----------|---------|
| `mobile-calendar-layout.tsx` | Main wrapper with header, week strip, content area |
| `mobile-calendar-header.tsx` | 3-dot menu (left), month picker (center), + create (right) |
| `mobile-week-strip.tsx` | Swipeable week selector with lazy loading |
| `mobile-bottom-nav.tsx` | Tab bar: Calendar, Clients, Services, More |
| `mobile-more-sheet.tsx` | Full navigation menu (from More tab) |
| `mobile-settings-sheet.tsx` | Calendar filters and view options |
| `mobile-date-picker-sheet.tsx` | Full-screen scrollable month picker |

### Mobile Design Guidelines

**Layout**
- Use `100dvh` not `100vh` for dynamic viewport height
- Apply `safe-area-inset-*` for notch/home indicator
- Bottom nav is 56px + safe area padding
- Header is 48px height

**Touch Targets**
- Minimum 44×44pt for all interactive elements
- Use `min-w-[44px] min-h-[44px]` classes

**Scrolling**
- Hide scrollbars: `scrollbar-hide` class or `-ms-overflow-style: none`
- Use `-webkit-overflow-scrolling: touch` for momentum
- Week strip: `scroll-snap-type: x mandatory` with `scroll-snap-stop: always`

**Modals/Sheets**
- Use `Sheet` with `side="bottom"` and `className="h-full"` for full-screen
- Always include `SheetTitle` and `SheetDescription` (can be `sr-only`) for accessibility

**Interactions**
- No drag-and-drop on mobile (disabled via empty sensors array)
- Tap on 15-min time slots to create appointments
- Swipe week strip left/right to navigate weeks
- Tap date to select, appointments load on selection

**Mobile Calendar Cards**
- Appointment cards show 5 lines: time (no AM/PM), first name (4 chars), last name (4 chars), service word 1, service word 2
- Service names use shorthand mapping in `appointment-card.tsx` (e.g., "Natural Set" → "Nat Set")
- Block cards (personal events) use light gray (#C8C8C8) with dark gray text
- Card gaps: Both appointments and blocks use `height - 2` in `resource-calendar.tsx` for consistent 2px gaps
- **Important**: Do NOT add minimum height to block cards - mobile uses 72 PIXELS_PER_HOUR, so 15-min slots are only 18px. A minimum height would cause blocks to overflow their time slots and eliminate the gap

### PWA Configuration

**Manifest**: `public/manifest.json`
```json
{
  "name": "Bloom Admin",
  "short_name": "Bloom",
  "start_url": "/admin/calendar",
  "display": "standalone",
  "theme_color": "#1A1A1A"
}
```

**Icons**: `public/icons/`
- `icon-192.png`, `icon-512.png` - Android/PWA
- `apple-touch-icon.png` - iOS home screen

**Installation**: Safari → Share → Add to Home Screen
