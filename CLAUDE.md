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
2. `GET /api/v1/vendors/me` resolves the vendor **first** — an
   admin-provisioned vendor (now the only supported route in, CSV import
   included) already has its User row and never calls bootstrap. This ordering
   matters: `POST /auth/bootstrap` 409s when the token's phone or email already
   belongs to another User row, which used to block a valid email+password
   sign-in before the vendor was ever looked up
3. `POST /api/v1/auth/bootstrap` runs **only** when step 2 returns 401/403/404
   (no pharmacy here yet) — it creates the CUSTOMER row that
   `/vendor/onboarding` promotes on self-signup. A 409 at *that* point is
   genuine: the phone/email is on another account and the methods need linking.
   `LoginMethodsCard` also calls it after linking a provider, to fill the newly
   linked contact onto the row
4. Routing off step 2's result: `banned` → suspended screen,
   `pending` → **`/vendor/profile`**, `active` → dashboard
5. `lib/hooks/useRequireVendor.ts` is the client-side page guard (UX only —
   real authorization is the backend's role guards). It takes
   `{ allowPending }`, which **only `/vendor/profile` sets**: a pending vendor
   signs in, sees where its application stands and can still correct the
   details under review (`PATCH /vendors/me` allows PENDING by design; only
   BANNED is refused, and `POST /vendors/me/online` still needs ACTIVE). Every
   other page redirects a pending vendor to the profile rather than to login.
   The shell reacts too: while pending the sidebar shows Help Centre only, the
   `OnlineToggle` is replaced by an "awaiting approval" note, and a banner runs
   across the top. `ProfileClient` renders a `PendingNotice` that calls out a
   missing licence scan (the usual case for a CSV-imported pharmacy)
6. Tokens live in Firebase SDK persistence; every API call sends
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

- `new-order` `{orderId, orderNumber, expiresAt, total, isSimulated}` — beep + tab-title
  flash + toast, then refetch the pending list
- `order-status` `{orderId, status, isSimulated}` — silent store sync (covers the server's
  120 s auto-reject too)
- `simulation-reset` `{vendorId}` — clears simulated orders from store, refetches History and Settlements

`lib/hooks/useRealtimeOrders.tsx` is the primary hook; `useOrders.ts` is the
legacy refetch-on-any-event fallback used by OrdersClient.

### Order state machine (backend-enforced)

`PENDING → ACCEPTED → PACKING → PACKED → DISPATCHED → DELIVERED` (+ REJECTED /
CANCELLED). The panel's "Mark as Packed" chains packing → packed. Rejection is
only legal from PENDING. Countdowns derive from the server's `expiresAt` /
`secondsLeft` — never the client clock.

### Vendor profile (`/vendor/profile`)

`GET /vendors/me` returns the Vendor row plus `contactPerson` / `email` (from
the User row) and signed read URLs for the licence and FSSAI documents, so the
whole page comes from one call. What the vendor may edit (`PATCH /vendors/me`)
is deliberately narrow — pharmacy name, address, alternative contact, working
days and hours, **and the shop's map pin**. Everything else is admin-owned and
renders locked:

| Locked field | Why |
|---|---|
| Drug licence number + file, FSSAI certificate | changing them without re-review is a compliance hole |
| Contact phone, email | they are the Firebase login identity — Firebase must be updated in step |
| Bank / payout details | a vendor redirecting their own settlements is a payout-fraud hole |
| Commission, verification status | platform terms |

Support changes those through the admin panel's **Edit vendor** modal
(`PATCH /admin/vendors/:id`).

**The map pin is never derived from the address.** `Vendor.lat/lng` are
nullable and set only by dropping a marker — `components/vendor/LocationPicker.tsx`
on this page (Google Maps JS, draggable marker, tap-to-place, "use my current
location"), or by support pasting a Maps link into the admin Edit dialog. A
geocoded address is only as good as the text typed into it, and when it is
wrong it is wrong silently: riders arrive somewhere plausible but not at the
shop. Consequences worth knowing:

- editing `addressLine` never moves the pin, and vice versa; `lat`/`lng` must
  be PATCHed together (400 otherwise)
- a vendor with no pin **cannot be approved** — `POST /admin/vendors/:id/verification`
  with ACTIVE 400s, and `VendorSelectionService` excludes pin-less vendors as a
  backstop. This is why a pending vendor can reach this page: setting the pin is
  usually what approval is waiting on, and `PendingNotice` says so
- the picker needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Maps JavaScript API).
  Without it — or if the script fails — it degrades to a "paste a Google Maps
  link or coordinates" box, so a vendor is never blocked by a missing key
- Maps JS loads via `google.maps.importLibrary()` (the current-generation
  loader), not the classic `<script libraries=...>` tag — the marker is
  `AdvancedMarkerElement`, and the search box is a self-built,
  debounced-as-you-type dropdown backed by `AutocompleteSuggestion.fetchAutocompleteSuggestions()`
  plus `AutocompleteSessionToken` (Places API New), not the closed-shadow-DOM
  `PlaceAutocompleteElement` widget — this way the dropdown is plain markup
  styled to match the rest of the form. Picking a suggestion calls
  `PlacePrediction.toPlace().fetchFields()` for its location, drops the pin,
  and starts a fresh session token for the next search. Needs "Places API
  (New)" enabled on the key's project — the legacy "Places API" (used by the
  old `Autocomplete` widget) is a separate, no-longer-recommended product.
  `AdvancedMarkerElement` needs a vector Map ID —
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` isn't set yet, so it
  falls back to Google's `DEMO_MAP_ID`, which renders fine but stamps a "for
  development purposes only" watermark; create a real Map ID (Cloud Console →
  Maps Platform → Map Management) and set the env var to drop it

### Known phase-1 gaps (backend has no endpoint yet)

- Settlements ledger — payouts are offline; the page shows earnings from
  `/vendor/stats` with a breakdown per order and a separate "Simulated earnings (not paid out)" card for training orders
- History custom date ranges beyond the backend's 30-day window
- `registerVendor()` in `lib/api/index.ts` still posts to `/vendors/register`,
  which the backend removed when vendor self-signup was dropped — dead code,
  reachable only from `/vendor/onboarding`

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
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Maps JavaScript API, for the profile's location picker
                                  # (optional — the picker falls back to pasting a Maps link)
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=  # Vector Map ID for the picker's AdvancedMarkerElement
                                  # (optional — falls back to Google's watermarked DEMO_MAP_ID)
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
