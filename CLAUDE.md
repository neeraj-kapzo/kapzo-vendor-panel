# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There is no test runner configured. Supabase local development:

```bash
supabase start           # Start local Supabase stack
supabase db reset        # Reset DB and re-run all migrations
supabase functions serve # Serve edge functions locally
```

## Architecture

**Next.js 15 App Router** with a server/client component split pattern throughout.

### Route Structure

All vendor routes live under `app/vendor/`. The root `app/page.tsx` redirects to `/vendor/login`.

- `app/vendor/layout.tsx` — Shell with sidebar + header (client component)
- Each route follows the pattern: `page.tsx` (server) + `*Client.tsx` (client)

### Server/Client Split Pattern

Every page uses this two-file pattern:
- **`page.tsx`** — async server component; checks auth, fetches initial data with parallel `Promise.all()`, redirects on auth failure, passes data as props to the client component
- **`*Client.tsx`** — interactive client component; receives initial data, sets up Zustand store, handles realtime subscriptions and user actions

### Authentication

1. Login at `/vendor/login` (email + password, then 6-digit OTP)
2. Supabase sets HTTP-only session cookies
3. `proxy.ts` middleware calls `updateSession()` on every request
4. Protected routes do `createClient().auth.getUser()` server-side and `redirect()` on failure

Supabase clients:
- `lib/supabase/client.ts` — browser client (use in client components)
- `lib/supabase/server.ts` — server client with cookie management (use in `page.tsx` and Server Actions)

### State Management (Zustand)

`lib/store/vendorStore.ts` holds global vendor state:
- `vendor` — current vendor profile
- `isOnline` — online/offline toggle
- `pendingOrders` — incoming orders awaiting action
- `activeOrders` — non-terminal orders
- `unreadOrderCount` — badge count for orders nav item

### Realtime Orders

Two hook implementations:
- `lib/hooks/useRealtimeOrders.tsx` — primary; separate INSERT vs UPDATE handling; INSERT triggers Web Audio API beep + tab title flash + toast; UPDATE silently syncs status
- `lib/hooks/useOrders.ts` — legacy catch-all fallback with full refetch on any change

### Database (Supabase)

Key tables: `vendors`, `catalog_items`, `vendor_inventory`, `orders`, `order_items`, `notifications`

Order status flow: `pending` → `accepted` → `packing` → `packed` → `dispatched` → `delivered` (or `rejected`/`cancelled`)

RLS is enabled on all tables. The anon key respects all policies. Server-side queries use the server client which reads the session cookie.

Edge function `auto-reject-orders` bulk-rejects orders stuck in `pending` for >120 seconds.

The PostgreSQL function `get_vendor_stats()` is used on the dashboard for aggregated metrics.

Type definitions for the full database schema are in `types/database.types.ts`.

### Styling

**Tailwind CSS v4** — no `tailwind.config.ts`. All design tokens are defined inline in `app/globals.css` via `@theme {}`:
- Brand colors: Kapzo Green `#21A053`, Navy `#00326F`, Dark `#022135`
- Font: Neulis Alt (loaded from `public/fonts/`, referenced in CSS)
- Border radius tokens: `card` (12px), `btn` (8px), `pill` (999px)

Utility: use `clsx` + `tailwind-merge` (via `cn()` helper) for conditional class names.

### UI Components

`components/ui/` — internal library: `Button`, `Input`, `Modal`, `Card`, `Badge`, `Toggle`, `Skeleton`. No external UI library.

Modal components use a portal pattern — render outside the normal DOM tree.

### Demo Mode

Set `NEXT_PUBLIC_DEMO_MODE=true` to run the entire app with mock data — no Supabase connection needed.

When active:
- Middleware skips auth; all `/vendor/*` routes are accessible without login
- Login page shows an **Enter Demo Mode** button that goes straight to the dashboard
- All server pages return data from `lib/demo/index.ts` instead of querying Supabase
- Client hooks (`useVendor`, `useOrders`) skip Supabase subscriptions
- All write operations (order status changes, inventory saves, online toggle) update local state only
- **"Simulate New Order"** button appears on Dashboard and Orders pages — triggers the full alert experience: audio beep, tab title flash, sliding toast, and adds a pending order with a live 2-minute countdown timer
- A yellow **Demo Mode** banner is shown in the layout

Key files:
- `lib/demo/index.ts` — all mock data and generator functions
- `lib/demo/demoStore.ts` — Zustand store for sharing simulated orders between pages

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEMO_MODE=        # set to "true" to enable demo mode
```
