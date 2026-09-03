# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (Next.js)
pnpm build      # Static export → out/ (this is the deployable artifact)
pnpm lint       # Run ESLint
```

There is no test runner configured. The backend (`../kapzo-backend`) has its own
repo, commands, and docs — run it locally with Docker Postgres + `npm run start:dev`
when developing against real data, or use demo mode (below) for pure-UI work.

## Architecture

**Next.js 16 App Router, fully client-side rendered** — `next.config.ts` sets
`output: 'export'`, so `pnpm build` produces a static site in `out/` for
Google Cloud Storage hosting. There is no server runtime: no middleware, no
server components with data fetching, no cookies. All data comes from the
**kapzo-backend NestJS API** (REST under `/api/v1` + Socket.IO), authenticated
with **Firebase ID tokens**.

### Route Structure

All vendor routes live under `app/vendor/`. The root `app/page.tsx` client-redirects
to `/vendor/login`.

- `app/vendor/layout.tsx` — shell with sidebar + header (client component)
- Each route is `page.tsx` (thin client wrapper: auth gate → initial fetch →
  skeleton) + `*Client.tsx` (the interactive UI, unchanged shapes from the
  Supabase era)

### Data layer (`lib/api/`)

The UI keeps its historical snake_case / lowercase-status domain types
(`types/database.types.ts`). All backend knowledge lives in `lib/api/`:

- `http.ts` — fetch wrapper: `NEXT_PUBLIC_API_URL` + `/api/v1`, attaches the
  Firebase ID token, throws `ApiError` from the Nest error envelope
- `types.ts` — backend-native response shapes (camelCase, UPPERCASE enums)
- `mappers.ts` — backend row → UI domain row (statuses lowercased,
  Decimal strings → numbers)
- `index.ts` — one typed function per endpoint (vendors/me, vendor/orders +
  transitions, vendor/stats, vendor/orders/history, inventory, notifications,
  storage upload-url)

### Authentication

1. `/vendor/login` — Firebase phone OTP (invisible reCAPTCHA) or email+password
2. `POST /api/v1/auth/bootstrap` upserts the backend User row
3. `GET /api/v1/vendors/me` resolves the vendor: 404 → onboarding,
   `pending`/`banned` → status screens, `active` → dashboard
4. `lib/hooks/useRequireVendor.ts` is the client-side page guard (UX only —
   real authorization is the backend's role guards)
5. Tokens live in Firebase SDK persistence; every API call sends
   `Authorization: Bearer <ID token>`

Vendor self-signup path: phone OTP creates the Firebase account → backend
bootstrap creates a CUSTOMER user → `/vendor/onboarding` uploads the license
via GCS signed URL and calls `POST /vendors/register` (flips role to VENDOR,
status PENDING until admin approval).

### State Management (Zustand)

`lib/store/vendorStore.ts` holds global vendor state: `vendor`, `isOnline`,
`pendingOrders`, `activeOrders`, `unreadOrderCount`.

### Realtime Orders (Socket.IO)

`lib/realtime.ts` keeps a singleton `socket.io-client` connection to the
backend; the handshake carries the Firebase token in `auth.token` and the
server auto-joins the vendor room. Events:

- `new-order` `{orderId, orderNumber, expiresAt, total}` — beep + tab-title
  flash + toast, then refetch the pending list
- `order-status` `{orderId, status}` — silent store sync (covers the server's
  120 s auto-reject too)

`lib/hooks/useRealtimeOrders.tsx` is the primary hook; `useOrders.ts` is the
legacy refetch-on-any-event fallback used by OrdersClient.

### Order state machine (backend-enforced)

`PENDING → ACCEPTED → PACKING → PACKED → DISPATCHED → DELIVERED` (+ REJECTED /
CANCELLED). The panel's "Mark as Packed" chains packing → packed. Rejection is
only legal from PENDING. Countdowns derive from the server's `expiresAt` /
`secondsLeft` — never the client clock.

### Known phase-1 gaps (backend has no endpoint yet)

- Vendor profile editing, bank details, working hours — profile is read-only
- License/FSSAI preview — needs a signed-read-URL endpoint
- Settlements ledger — payouts are offline; the page shows earnings from
  `/vendor/stats` and an empty transaction list
- History custom date ranges beyond the backend's 30-day window

### Styling

**Tailwind CSS v4** — no `tailwind.config.ts`. Design tokens in
`app/globals.css` via `@theme {}`. Brand: Kapzo Green `#21A053`, Navy
`#00326F`, Dark `#022135`; Neulis Alt from `public/fonts/`. Use the `cn()`
helper for conditional classes. `components/ui/` is an internal library
(Button, Input, Modal, Card, Badge, Toggle, Skeleton) — no external UI kit.

### Demo Mode

Set `NEXT_PUBLIC_DEMO_MODE=true` — the entire app runs on mock data from
`lib/demo/index.ts`, no backend or Firebase needed. Login shows **Enter Demo
Mode**; "Simulate New Order" triggers the full alert experience. Demo data
passed as props from client pages MUST be memoized (`useMemo`) — fresh arrays
every render re-trigger store-seeding effects infinitely.

## Environment Variables

```
NEXT_PUBLIC_API_URL=            # kapzo-backend origin, no /api/v1 suffix
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_DEMO_MODE=          # "true" enables demo mode
```

## Deploying to Google Cloud Storage

Production is **https://vendor.kapzo.in** — the `out/` export in the public bucket
`gs://kapzo-vendor-panel-prod`, served by the shared Kapzo load balancer (host rule on
`kapzo-api-urlmap`). The full runbook, including the exact build-time env vars
and the one-time bucket / URL-map setup, is **`docs/DEPLOYMENT.md`**; the shared
load balancer, certificate, DNS and CORS/Firebase allow-lists are in
`kapzo-backend/docs/DEPLOYMENT.md` §3.8.

Short version:

```bash
# env vars must come from the shell — .env.local outranks .env.production
export NEXT_PUBLIC_API_URL=https://api.kapzo.in NEXT_PUBLIC_DEMO_MODE=false \
       NEXT_PUBLIC_FIREBASE_API_KEY=... NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kapzo-prod.firebaseapp.com \
       NEXT_PUBLIC_FIREBASE_PROJECT_ID=kapzo-prod NEXT_PUBLIC_FIREBASE_APP_ID=...
rm -rf .next out && pnpm build
gcloud storage rsync out gs://kapzo-vendor-panel-prod --recursive --delete-unmatched-destination-objects
gcloud storage objects update "gs://kapzo-vendor-panel-prod/_next/static/**" --cache-control="public, max-age=31536000, immutable"
gcloud storage objects update "gs://kapzo-vendor-panel-prod/**.html" --cache-control="no-cache, max-age=0, must-revalidate"
```
