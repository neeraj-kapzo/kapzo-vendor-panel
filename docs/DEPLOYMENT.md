# Kapzo Vendor Panel — deployment runbook (Google Cloud Storage)

Production URL: **https://vendor.kapzo.in** · Bucket: **`gs://kapzo-vendor-panel-prod`** · GCP project: `kapzo-prod`

This app is a Next.js static export (`output: "export"`, `trailingSlash: true`).
There is no server: `pnpm build` writes plain files to `out/`, and those files
are copied into a public GCS bucket that the shared Kapzo load balancer serves
at `vendor.kapzo.in`. First deployed 2026-09-02; every command below was run then.

The load balancer, certificate and DNS are **shared with the API and the other
panels** and are documented once, in
`kapzo-backend/docs/DEPLOYMENT.md` §3.8. This file covers only what is specific
to this panel.

---

## 0. Routine release (copy-paste)

**Scripted:** `bash docs/deploy.sh` runs every step below (preflight, build,
sanity checks, upload, cache headers, live verification) and stops at the
first failure. `--dry-run` builds and checks without uploading; `--skip-build`
uploads an existing `out/`. The Firebase web API key and the (optional)
Google Maps API key / Map ID are read from the environment or `.env.local`.
The manual steps are kept here for reference.

Run from this directory, on the commit you want to ship, with `gcloud` logged in
as a `kapzo-prod` editor (`gcloud config set project kapzo-prod`).

```bash
# 1. Production build. The env vars MUST be passed via the shell environment:
#    .env.local (localhost API, sometimes demo mode) has higher precedence
#    than .env.production, so a file-based override would be ignored.
export NEXT_PUBLIC_API_URL=https://api.kapzo.in
export NEXT_PUBLIC_DEMO_MODE=false
export NEXT_PUBLIC_FIREBASE_API_KEY=<web API key: Firebase console > kapzo-prod > Project settings>
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kapzo-prod.firebaseapp.com
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=kapzo-prod
export NEXT_PUBLIC_FIREBASE_APP_ID=1:756344915330:web:90c5a71d2c9437760a3b9b
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<Maps JS API key — optional, picker falls back to pasting a Maps link>
export NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<vector Map ID — optional, falls back to Google's watermarked DEMO_MAP_ID>
rm -rf .next out && pnpm build   # runs next build + scripts/fix-segment-files.mjs (see §1)

# 2. Sanity-check the bundle before uploading.
grep -l "api.kapzo.in" out/_next/static/chunks/*.js | head -1      # must print a file
grep -l "localhost:8080" out/_next/static/chunks/*.js               # must print nothing

# 3. Upload. --delete-unmatched-destination-objects removes stale hashed chunks.
gcloud storage rsync out gs://kapzo-vendor-panel-prod --recursive --delete-unmatched-destination-objects

# 4. Cache headers: hashed assets forever, HTML always revalidated.
gcloud storage objects update "gs://kapzo-vendor-panel-prod/_next/static/**" --cache-control="public, max-age=31536000, immutable"
gcloud storage objects update "gs://kapzo-vendor-panel-prod/**.html"          --cache-control="no-cache, max-age=0, must-revalidate"

# 5. Verify.
curl -s -o /dev/null -w "%{http_code}\n" https://vendor.kapzo.in/vendor/login/     # 200
```

PowerShell users: replace each `export NAME=value` with `$env:NAME = "value"`;
everything else is identical.

Steps 3–4 take about a minute for ~150 objects. Because HTML is `no-cache` and
chunk names are content-hashed, users get the new version on their next page
load without a CDN purge. If you ever need to force it anyway:

```bash
gcloud compute url-maps invalidate-cdn-cache kapzo-api-urlmap --host vendor.kapzo.in --path "/*"
```

---

## 1. How a request reaches this bucket

```
browser -> DNS: vendor.kapzo.in -> 8.233.74.117 (shared static IP kapzo-api-ip)
        -> HTTPS proxy kapzo-api-https-proxy (SNI picks cert kapzo-panels-cert)
        -> URL map kapzo-api-urlmap: host rule "vendor.kapzo.in" -> path matcher "vendor-panel"
        -> backend bucket kapzo-vendor-panel-prod-bb (Cloud CDN on)
        -> gs://kapzo-vendor-panel-prod/<path>   (+ index.html for "/" paths, 404.html when missing)
```

- The bucket has website config `main page = index.html`, `error page = 404.html`.
  The load balancer honours it, so `/vendor/login/` serves the object
  `vendor/login/index.html`. That is why `next.config.ts` sets
  `trailingSlash: true` — it makes Next emit `<route>/index.html` rather than
  `<route>.html`. A request without the trailing slash gets a 301 to the
  `/index.html` form, which the app then handles client-side.
- Everything under `out/` is uploaded, **including the `__next.*.txt` files**.
  They are the React Server Component payloads the Next router fetches for
  soft navigation between pages; leaving them out makes every link a full
  reload.
- **Windows builds:** Next.js 16.1.6's exporter derives the segment file names
  with `path.relative`, so on Windows the nested part carries backslashes and
  `__next.vendor.orders.txt` is written as the folder `__next.vendor/orders.txt`.
  The router requests the flat dotted name, so every nested-route prefetch 404s
  and each sidebar click becomes a full reload. `pnpm build` therefore runs
  `scripts/fix-segment-files.mjs`, which flattens those folders (a no-op on
  Linux/macOS). Sanity check after a build: `find out -type d -name '__next.*'`
  must print nothing. Found and fixed 2026-09-06.
- Unknown paths return the exported `404.html` with a real 404 status.
- Host rules and path matchers live only in the GCP URL map resource, not in
  this repo. Inspect them with
  `gcloud compute url-maps describe kapzo-api-urlmap --format="yaml(defaultService,hostRules,pathMatchers)"`.

---

## 2. One-time setup (already done for kapzo-prod — for reference / DR)

```bash
B=kapzo-vendor-panel-prod; H=vendor.kapzo.in; M=vendor-panel

gcloud storage buckets create gs://$B --project=kapzo-prod --location=asia-south1 --uniform-bucket-level-access
gcloud storage buckets update gs://$B --web-main-page-suffix=index.html --web-error-page=404.html
gcloud storage buckets add-iam-policy-binding gs://$B --member=allUsers --role=roles/storage.objectViewer

gcloud compute backend-buckets create $B-bb --gcs-bucket-name=$B --enable-cdn --cache-mode=CACHE_ALL_STATIC

# Adds BOTH the path matcher and the host rule to the shared URL map.
gcloud compute url-maps add-path-matcher kapzo-api-urlmap \
  --path-matcher-name=$M --default-backend-bucket=$B-bb --new-hosts=$H
```

Then the shared steps in `kapzo-backend/docs/DEPLOYMENT.md` §3.8: add the host
to the managed certificate, the Hostinger A record, the backend `CORS_ORIGINS`
value and the Firebase Auth authorized domains.

---

## 3. Environment reference (build time only)

All values are baked into the JS bundle at `pnpm build`; changing one means a
rebuild + re-upload. None are secret (the Firebase web API key is public by
design and is restricted by the authorized-domains list).

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.kapzo.in` (origin only, no `/api/v1`) |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | web API key of Firebase project `kapzo-prod` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `kapzo-prod.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `kapzo-prod` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:756344915330:web:90c5a71d2c9437760a3b9b` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS API key, restricted to this panel's origins — optional; blank degrades the profile's location picker to pasting a Maps link |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Vector Map ID for the picker's `AdvancedMarkerElement` — optional; blank falls back to Google's `DEMO_MAP_ID`, which renders but shows a "for development purposes only" watermark |

---

## 4. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Page loads but every API call hits `localhost:8080` | Build ran without the exported env vars (`.env.local` won). Rebuild per §0 step 1 and re-check with step 2. |
| Demo data shows in production | Same cause: `NEXT_PUBLIC_DEMO_MODE` not `false` at build time. |
| Login fails with `auth/unauthorized-domain` | `vendor.kapzo.in` missing from Firebase Auth authorized domains — see backend runbook §3.8. |
| API calls fail with a CORS error | `vendor.kapzo.in` missing from the backend's `CORS_ORIGINS` (backend runbook §6.2). |
| A route returns the 404 page right after a deploy | Upload incomplete, or `--delete-unmatched-destination-objects` ran against a partial `out/`. Rebuild and re-run steps 3–4. |
| Links inside the app trigger full page reloads | `__next.*.txt` payloads not uploaded (an `--exclude` on `.txt` was used). Re-run step 3 without excludes. |
| Old UI still showing after deploy | HTML should be `no-cache`; check with `curl -sI https://vendor.kapzo.in/vendor/login/` and look at `cache-control`. If wrong, re-run step 4 or invalidate the CDN (§0). |
| Cert domain status `FAILED_NOT_VISIBLE`, or the host opens a Hostinger 403 page while the LB IP works | A stray **AAAA** record on `vendor.kapzo.in` (Hostinger adds one pointing at its own hosting when a subdomain is created via the Websites flow). Delete it in hPanel DNS; verify with `nslookup -type=AAAA vendor.kapzo.in ns1.dns-parking.com`. Google re-validates on its own; ISP resolvers may cache the old answer for ~25 min. Seen 2026-09-02. |
| TLS handshake fails / `HTTP 000` on the hostname | Managed cert not `ACTIVE`; check `gcloud compute ssl-certificates describe kapzo-panels-cert --global`. Usually DNS. |
| `__next.<route>.txt?_rsc=…` requests return 404 and links do full reloads | Build was made on Windows without the flatten step (see §1). Run `node scripts/fix-segment-files.mjs out` (or just `pnpm build`, which includes it) and re-upload with step 3. |
| `gcloud storage objects update "gs://.../**.txt"` hangs | Seen once on 2026-09-02; leave the `.txt` files with default cache headers (CDN does not cache `text/plain` under `CACHE_ALL_STATIC`). |
