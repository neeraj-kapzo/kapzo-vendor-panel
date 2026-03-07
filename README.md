# Kapzo Vendor Panel

Pharmacy/vendor-facing web portal for the **Kapzo** medicine delivery platform (think: Swiggy for medicines). Vendors use this panel to manage orders, inventory, and track earnings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Backend / DB | Supabase (PostgreSQL + Realtime + Auth + Edge Functions) |
| State | Zustand 5 |
| Dates | date-fns 4 |
| Charts | Recharts 3 |
| Icons | lucide-react |
| Toasts | react-hot-toast |
| Utilities | clsx, tailwind-merge |
| Package Manager | pnpm |

---

## Prerequisites

- Node.js >= 18
- pnpm (`npm install -g pnpm`)
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (cloud) — [supabase.com](https://supabase.com)

---

## Local Setup

### 1. Clone & install dependencies

```bashlog
git clone <repo-url>
cd kapzo-vendor-panel
pnpm install
```

### 2. Create environment file

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Get these from: **Supabase Dashboard → Project Settings → API**.

### 3. Push database migrations

```bash
npx supabase db push
```

This applies all migrations in `supabase/migrations/` to your remote Supabase project in order.

### 4. Run the dev server

```bash
pnpm dev
```

App runs at `http://localhost:3000`. It auto-redirects to `/vendor/login`.

---

## Key Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `npx supabase db push` | Push local migrations to remote Supabase |
| `npx supabase db pull` | Pull remote schema changes to local |
| `npx supabase db reset` | Reset local Supabase DB and re-run migrations |
| `npx supabase functions deploy auto-reject-orders` | Deploy Edge Function |
| `npx supabase login` | Authenticate Supabase CLI |
| `npx supabase link --project-ref <ref>` | Link CLI to a Supabase project |

---

## Project Structure

```
kapzo-vendor-panel/
├── app/
│   ├── globals.css                   # Tailwind v4 @theme tokens + keyframes
│   ├── layout.tsx                    # Root layout — fonts, Toaster
│   ├── page.tsx                      # Redirects → /vendor/login
│   └── vendor/
│       ├── layout.tsx                # Shell: collapsible sidebar + VendorHeader
│       ├── login/page.tsx            # Split-screen login (email/password + OTP)
│       ├── onboarding/page.tsx       # New vendor registration flow
│       ├── dashboard/
│       │   ├── page.tsx              # Server: fetches stats + active orders
│       │   └── DashboardClient.tsx   # Online toggle, stats cards, order alerts
│       ├── orders/
│       │   ├── page.tsx              # Server: fetches active + closed orders
│       │   └── OrdersClient.tsx      # Realtime orders, timer ring, status workflow
│       ├── inventory/
│       │   ├── page.tsx              # Server: LEFT JOIN catalog + vendor_inventory
│       │   └── InventoryClient.tsx   # Table/grid view, inline edit, bulk actions
│       └── history/
│           ├── page.tsx              # Server: passes vendorId only
│           └── HistoryClient.tsx     # Date filters, summary cards, CSV export
│
├── components/
│   ├── auth/
│   │   ├── AuthBrandPanel.tsx        # Left-side brand panel on login
│   │   ├── KapzoLogo.tsx             # SVG logo mark
│   │   └── OtpInput.tsx              # 6-digit OTP input with auto-advance
│   ├── ui/
│   │   ├── Badge.tsx                 # OrderStatusBadge, VendorStatusBadge
│   │   ├── Button.tsx                # Primary/secondary/ghost variants
│   │   ├── Card.tsx                  # Base card wrapper
│   │   ├── Input.tsx                 # Styled text input
│   │   ├── Modal.tsx                 # Portal-based modal (escapes sidebar stacking context)
│   │   ├── Skeleton.tsx              # Loading skeleton blocks
│   │   └── Toggle.tsx                # Switch toggle component
│   └── vendor/
│       ├── InventoryRow.tsx          # Single row in inventory table
│       ├── NewOrderToast.tsx         # Custom toast for incoming orders
│       ├── OnlineToggle.tsx          # Online/offline toggle (compact + prominent)
│       ├── OrderCard.tsx             # Order card for active orders feed
│       ├── OrderFeedCard.tsx         # Compact order card for dashboard
│       ├── StatsCard.tsx             # Dashboard stats card
│       └── VendorHeader.tsx          # Top header with hamburger + notifications
│
├── lib/
│   ├── utils.ts                      # cn(), formatCurrency(), formatDate(), timeAgo()
│   ├── hooks/
│   │   ├── useVendor.ts              # Fetches vendor by user_id, caches in store
│   │   ├── useOrders.ts              # Active orders + catch-all realtime sub
│   │   └── useRealtimeOrders.ts      # INSERT (alert+beep) vs UPDATE (UI sync)
│   ├── store/
│   │   └── vendorStore.ts            # Zustand: vendor, isOnline, pendingOrders, activeOrders
│   └── supabase/
│       ├── client.ts                 # createBrowserClient<Database>
│       ├── server.ts                 # createServerClient<Database> (async, cookies)
│       └── middleware.ts             # updateSession() — refreshes auth cookies
│
├── types/
│   └── database.types.ts             # Full Database type + Row/Insert/Update + joined types
│
├── supabase/
│   ├── config.toml                   # Supabase CLI config (project_id, ports, auth settings)
│   ├── functions/
│   │   └── auto-reject-orders/
│   │       └── index.ts              # Edge Function: auto-reject pending orders > 2 min old
│   └── migrations/
│       ├── 20250307000001_initial_schema.sql      # Enums, tables, indexes, RLS, triggers
│       ├── 20250307000002_seed_catalog.sql        # Sample catalog items
│       ├── 20250307000003_dev_vendor_setup.sql    # Dev vendor seed data
│       ├── 20250307000004_notifications_and_storage.sql  # Notifications table + Storage bucket
│       ├── 20250307000005_rls_policies.sql        # Row Level Security policies
│       ├── 20250307000006_vendor_stats_fn.sql     # get_vendor_stats() PostgreSQL function
│       └── 20250307000007_fix_notifications_rls.sql  # Fix: cast recipient_id::text
│
├── public/
│   ├── icons/                        # Favicon set (16x16, 32x32, 192x192, 512x512, apple)
│   └── images/                       # Static images (photos, illustrations)
│
├── proxy.ts                          # Next.js 16 middleware entry (calls updateSession)
├── middleware.ts                     # Legacy middleware (kept for compatibility)
├── package.json
├── tsconfig.json
└── .env.local                        # Not committed. See setup step 2.
```

---

## Database Schema

### Tables

| Table | Description |
|---|---|
| `vendors` | One row per pharmacy. Linked to `auth.users` via `user_id`. |
| `catalog_items` | Master medicine catalogue managed by admin. |
| `vendor_inventory` | Per-vendor stock, price, and availability per catalog item. |
| `orders` | Customer orders placed with a vendor. |
| `order_items` | Line items (medicines) within an order. |
| `notifications` | In-app notifications for vendors and other roles. |

### Enums

```sql
vendor_status: 'pending' | 'active' | 'banned'
order_status:  'pending' | 'accepted' | 'packing' | 'packed' | 'dispatched' | 'delivered' | 'rejected' | 'cancelled'
```

### Key DB Function

```sql
get_vendor_stats(p_vendor_id UUID)
-- Returns: orders_today, pending_count, revenue_today, acceptance_rate
-- Used by the dashboard stats cards. Single CTE query with IST timezone support.
```

### Triggers

- `orders_set_updated_at` — auto-sets `updated_at` on every orders UPDATE.

---

## Authentication Flow

1. Vendor visits `/vendor/login` and signs in with email + password via Supabase Auth.
2. On success, Supabase sets an HTTP-only session cookie.
3. `proxy.ts` (Next.js middleware) calls `updateSession()` on every request to refresh the cookie.
4. All `/vendor/*` routes (except `/vendor/login`) check `supabase.auth.getUser()` server-side and redirect to login if unauthenticated.

---

## Realtime

Two separate patterns are used:

| Hook | Events | Behavior |
|---|---|---|
| `useRealtimeOrders` | INSERT | Plays audio beep, flashes tab title, shows toast, adds to pending store |
| `useRealtimeOrders` | UPDATE | Updates order status in Zustand store |
| `useOrders` | `*` (catch-all) | Re-fetches all active orders from DB (used by OrdersClient) |

All channels are cleaned up with `supabase.removeChannel()` on unmount.

---

## State Management (Zustand)

`lib/store/vendorStore.ts` — single global store:

| State | Type | Description |
|---|---|---|
| `vendor` | `Vendor \| null` | Current vendor profile |
| `isOnline` | `boolean` | Pharmacy online/offline status |
| `pendingOrders` | `Order[]` | Incoming orders not yet actioned |
| `activeOrders` | `Order[]` | All non-terminal orders |
| `unreadOrderCount` | `number` | Badge count on Orders nav item |

---

## Edge Function: auto-reject-orders

Located at `supabase/functions/auto-reject-orders/index.ts`.

- Queries `orders` where `status = 'pending'` AND `created_at < now() - 120s`
- Bulk-updates them to `status = 'rejected'` with `rejection_reason = 'Auto-rejected: vendor did not respond in time'`
- Intended to be triggered every 2 minutes via pg_cron (see migration 000006 for the commented schedule snippet)

**Deploy:**
```bash
npx supabase functions deploy auto-reject-orders
```

---

## Brand / Design System

Defined in `app/globals.css` using Tailwind v4 `@theme inline {}`:

| Token | Value |
|---|---|
| Primary Green | `#21A053` |
| Navy Blue | `#00326F` |
| Deep Dark | `#022135` |
| Font | DM Sans (body), Sora (display) |
| Card radius | `12px` |
| Button radius | `8px` |
| Pill radius | `999px` |
| Gradient | `linear-gradient(135deg, #21A053, #00326F)` |

Use brand colors with `text-[#21A053]`, `bg-[#022135]`, etc. or CSS variables `var(--kapzo-green)`, `var(--kapzo-navy)`, `var(--kapzo-dark)`.

---

## Static Assets

```
public/
  icons/    <- Favicon set. Referenced in app/layout.tsx.
  images/   <- General images (photos, banners, illustrations).
```

**Usage:**
```tsx
import Image from 'next/image'
<Image src="/images/banner.png" alt="..." width={400} height={200} />
<img src="/icons/favicon-32x32.png" />
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |

Both are prefixed `NEXT_PUBLIC_` so they are available in browser code. They are safe to expose — Supabase RLS policies protect the data.

---

## Common Gotchas

- **Tailwind v4** — No `tailwind.config.ts`. All tokens are in `app/globals.css` under `@theme inline {}`.
- **Modal portal** — `Modal.tsx` uses `createPortal(…, document.body)` to escape the sidebar's fixed stacking context. Don't render modals inside the sidebar DOM.
- **Supabase types** — Every table in `database.types.ts` must have `Relationships: []` (or a real array). Without it, joined queries fall back to `never`.
- **`redirect()` in App Router** — Returns `never`. TypeScript correctly narrows after `if (!data) redirect(...)`.
- **pnpm only** — Don't use `npm install` or `yarn add`. The lockfile is pnpm-specific.
- **RLS on every table** — All tables have RLS enabled. The service role key bypasses RLS (Edge Functions only). The anon key respects all policies.
- **Unicode in SQL** — Do not use Unicode box-drawing characters (`─`) in SQL migration files. The Supabase SQL parser rejects them. Use plain ASCII dashes.
