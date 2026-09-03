# Vendor Panel — kapzo-backend Integration + CSR Conversion — Design Spec

**Date:** 2026-08-05
**Status:** Approved for implementation (autonomous session; decisions flagged for review in final report)
**Goal:** Replace all Supabase usage in `kapzo-vendor-panel` with the NestJS
`kapzo-backend` REST API + Socket.IO + Firebase Auth, and convert the app to a
fully client-side rendered static export deployable to Google Cloud Storage.

---

## 1. Constraints & context

- Backend: `kapzo-backend` — REST under `/api/v1`, Firebase ID-token bearer
  auth, Socket.IO realtime (rooms `vendor:{vendorId}`, `user:{userId}`),
  GCS signed-URL uploads, server-side 120 s auto-reject (`expiresAt`).
- GCS static hosting = no server: no middleware, no server components, no
  cookies, no `next/image` optimizer, no dynamic routes.
- Demo mode must keep working unchanged (it's used for sales demos).
- The panel UI is large (~4k lines of client components) and already works
  against snake_case row types in `types/database.types.ts`.

## 2. Approach (chosen)

**Anti-corruption layer:** keep the UI's existing domain types (snake_case,
lowercase statuses) and put all backend knowledge in a new `lib/api/` module
that maps backend camelCase/UPPERCASE responses into those domain types.

Rejected alternatives:
- *Full rewrite to backend-native camelCase types* — touches every UI file
  (~4k lines) with no user-visible gain; high regression risk in one shot.
- *Local Next.js API-route proxy* — impossible on GCS (no server).

## 3. Architecture

```
UI components (unchanged shapes)
   │  domain types: types/database.types.ts (Supabase Database interface removed,
   │  row types kept + extended: order_number, items[], expires_at, address_line…)
   ▼
lib/api/            ← NEW anti-corruption layer
  http.ts           fetch wrapper: NEXT_PUBLIC_API_URL + /api/v1, attaches
                    Firebase ID token, parses Nest error envelope
  auth.ts           bootstrap(), role/vendor resolution
  vendors.ts        getMe, setOnline, register
  orders.ts         list (per status), accept/reject/packing/packed/dispatched
  stats.ts          /vendor/stats, /vendor/orders/history
  inventory.ts      list (q, page), upsert
  notifications.ts  list, markRead
  storage.ts        upload-url + direct PUT to GCS
  mappers.ts        backend row → domain row (status lowercased, Decimal→number)
lib/firebase.ts     ← NEW Firebase web SDK init + email/password auth
lib/hooks/useRealtimeOrders.tsx  ← rewritten on socket.io-client
lib/hooks/useAuthGuard.ts        ← NEW client-side auth gate
```

### Auth flow (replaces Supabase cookies + middleware)
1. `signInWithEmailAndPassword` (Firebase JS SDK, persistent local storage).
2. `POST /api/v1/auth/bootstrap` with bearer token → User row.
3. `GET /api/v1/vendors/me` → vendor row (404 → onboarding; PENDING →
   "awaiting approval" screen; BANNED → blocked screen).
4. Every API call: `user.getIdToken()` (SDK caches/refreshes) → `Authorization:
   Bearer <token>`.
5. Route protection is client-side: `useAuthGuard` in the vendor layout
   redirects to `/vendor/login` when signed out. (Real authorization lives in
   the backend guards; the client gate is UX only.)

### Onboarding (replaces Supabase insert + storage upload)
`createUserWithEmailAndPassword` → bootstrap → `POST /storage/upload-url`
(purpose `license`) → `PUT` file to signed URL → `POST /vendors/register`
(licenseFileKey) → pending-approval screen.

### Realtime (replaces Supabase postgres_changes)
`socket.io-client` connects to `NEXT_PUBLIC_API_URL` with
`auth: { token: <Firebase ID token> }`; server auto-joins `vendor:{id}`.
- `new-order` `{orderId, orderNumber, expiresAt, total}` → beep + tab-flash +
  toast (existing UX), then refetch PENDING list for the full row.
- `order-status` `{orderId, status}` → store `updateOrderStatus` (lowercased).
- Reconnect uses a fresh ID token (socket.io `auth` as a function).

### Page conversion (CSR)
Every `page.tsx` drops `async`/server code and becomes a thin `'use client'`
component: auth gate → client-side initial fetch (same queries the server
version ran, now via `lib/api/`) → renders the existing `*Client.tsx` with the
same props. Loading states use existing `Skeleton` components. Demo mode
branches are preserved verbatim.

Endpoint wiring per page:
| Page | Backend calls |
|---|---|
| dashboard | `vendors/me`, `vendor/stats?range=today`, `vendor/orders` (active statuses) |
| orders | `vendor/orders?status=…` per tab; transitions via action endpoints |
| inventory | `vendors/me/inventory?q=&page=`, `PUT vendors/me/inventory/:catalogItemId` |
| history | `vendor/orders/history?range=&page=` |
| settlements | `vendor/stats` + `vendor/orders/history` (earnings view; the old `settlements` table has no backend equivalent — settlement is offline in phase 1) |
| profile | `vendors/me` (read-only: backend has no vendor-update endpoint; bank/working-hours fields dropped; license shown as "on file", no preview — no read-url endpoint yet) |
| help | static + `vendors/me` |
| login | Firebase sign-in (email/password; Supabase OTP step removed — Firebase session replaces it) |
| onboarding | flow above |

Field gaps mapped to null/false (UI already tolerates): `rider_id`,
`prescription_url`, `prescription_verified`. New fields surfaced: `order_number`,
`seconds_left` (server-anchored countdown), `items[]` with name/price snapshots.

### next.config.ts
`output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`
(GCS serves `<route>/index.html`). Delete `proxy.ts` and `lib/supabase/*`.
Root `app/page.tsx` becomes a client redirect.

### Backend change (required)
`configure-app.ts` gains `app.enableCors({ origin: CORS_ORIGINS env
(comma-separated) or true, })` — without it a browser on the GCS domain cannot
call the API at all. Flagged in the backend followups doc as the open "CORS
decision"; implemented configurably here.

## 4. Env vars

```
NEXT_PUBLIC_API_URL=            # e.g. https://api.kapzo.in (no /api/v1 suffix)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_DEMO_MODE=          # unchanged
```

Dependencies: + `firebase`, `socket.io-client`; − `@supabase/ssr`,
`@supabase/supabase-js`.

## 5. Error handling

- `http.ts` throws `ApiError { status, message, requestId? }` parsed from the
  Nest envelope; UI keeps its existing toast/banner patterns.
- 401 from API → sign out + redirect to login (token revoked/user deleted).
- Socket auth failure → silent disconnect; hooks retry with fresh token.

## 6. Testing / verification

No test runner exists in the panel. Verification = `npm run build` (static
export must succeed, which also type-checks), `npm run lint`, and demo-mode
smoke via `npm run dev`. Backend contract verified against controller/DTO
source (this spec's endpoint table).

## 7. Out of scope

- Vendor profile editing, bank details, working hours (no backend endpoints).
- License/FSSAI document preview (needs a signed-read-URL endpoint — follow-up).
- Push notifications (FCM) for the web panel.
- GCS bucket provisioning/CI (deploy commands documented in README instead).
