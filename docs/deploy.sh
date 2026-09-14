#!/usr/bin/env bash
# Kapzo Vendor Panel — one-shot production deploy to Google Cloud Storage.
#
# Automates §0 "Routine release" of docs/DEPLOYMENT.md:
#   1. production build with the prod env vars forced via the shell
#   2. bundle sanity checks (API origin baked in, no localhost, flat segment files)
#   3. rsync out/ to the bucket (deletes stale hashed chunks)
#   4. cache headers (static assets immutable, HTML no-cache)
#   5. live verification against https://vendor.kapzo.in
#
# Usage (from any directory; Git Bash / WSL / macOS / Linux):
#   bash docs/deploy.sh              # full release
#   bash docs/deploy.sh --dry-run    # build + checks only, nothing uploaded
#   bash docs/deploy.sh --skip-build # upload the existing out/ (after a manual build)
#
# Env vars: `.env.prod` (gitignored, not committed) is the primary source
# when present — every `NEXT_PUBLIC_*` key in it is loaded before the build
# and wins over the hard-coded PROD_* defaults below. Without a `.env.prod`,
# behaviour is unchanged from before it existed: those PROD_* defaults are
# used, and the Firebase/Maps keys (which can't be hard-coded — they're
# environment-specific secrets-that-aren't-secret) fall back to `.env.local`.
# All of them are public by design (the Firebase key is restricted by
# authorized domains; the Maps key is restricted by HTTP referrer). The Maps
# key and Map ID are optional — the location picker degrades to pasting a
# Maps link, and a missing Map ID falls back to Google's watermarked
# DEMO_MAP_ID — so a deploy proceeds without them, just with that feature
# blank or watermarked in production.
#
# Requires: pnpm, gcloud (logged in as a kapzo-prod editor), curl, grep, find.

set -euo pipefail

# ── Settings ────────────────────────────────────────────────────────────────
BUCKET="gs://kapzo-vendor-panel-prod"
SITE_URL="https://vendor.kapzo.in"
VERIFY_PATH="/vendor/login/"
SEGMENT_CHECK="/vendor/orders/__next.vendor.orders.txt"
GCP_PROJECT="kapzo-prod"

PROD_API_URL="https://api.kapzo.in"
PROD_FIREBASE_AUTH_DOMAIN="kapzo-prod.firebaseapp.com"
PROD_FIREBASE_PROJECT_ID="kapzo-prod"
PROD_FIREBASE_APP_ID="1:756344915330:web:90c5a71d2c9437760a3b9b"

# ── Flags ───────────────────────────────────────────────────────────────────
DRY_RUN=false
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=true ;;
    --skip-build) SKIP_BUILD=true ;;
    -h|--help)    sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────────────────────────
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Run from the panel root regardless of where the script was invoked.
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
[ -f package.json ] && grep -q '"name": *"kapzo-vendor-panel"' package.json 2>/dev/null \
  || [ -d app/vendor ] || die "Not the kapzo-vendor-panel directory: $APP_DIR"

# ── 0. Preflight ────────────────────────────────────────────────────────────
step "Preflight"
for tool in pnpm gcloud curl grep find; do
  command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not on PATH"
done
ok "tools present"

# `.env.prod` takes priority over everything below it: loaded first, so any
# NEXT_PUBLIC_* it sets is already present by the time the .env.local
# fallbacks and PROD_* defaults are considered.
if [ -f .env.prod ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.prod
  set +a
  ok ".env.prod loaded"
fi

if [ -z "${NEXT_PUBLIC_FIREBASE_API_KEY:-}" ] && [ -f .env.local ]; then
  NEXT_PUBLIC_FIREBASE_API_KEY="$(grep -E '^NEXT_PUBLIC_FIREBASE_API_KEY=' .env.local | tail -1 | cut -d= -f2- | tr -d '\r"')"
fi
[ -n "${NEXT_PUBLIC_FIREBASE_API_KEY:-}" ] || die "NEXT_PUBLIC_FIREBASE_API_KEY is not set and not found in .env.local"
ok "Firebase API key resolved"

# Optional: the location picker on /vendor/profile degrades gracefully
# without either, so a missing key/Map ID is a warning, not a failure. The
# `|| true` matters under `set -o pipefail` — grep finding no line (the
# common case for the Map ID) must not abort the whole script.
if [ -z "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}" ] && [ -f .env.local ]; then
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$(grep -E '^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=' .env.local | tail -1 | cut -d= -f2- | tr -d '\r"')" || true
fi
if [ -z "${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:-}" ] && [ -f .env.local ]; then
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="$(grep -E '^NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=' .env.local | tail -1 | cut -d= -f2- | tr -d '\r"')" || true
fi
if [ -n "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}" ]; then
  ok "Google Maps API key resolved"
else
  printf '\033[1;33m  ! %s\033[0m\n' "No Google Maps API key — the profile's location picker will fall back to pasting a Maps link"
fi
if [ -z "${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:-}" ]; then
  printf '\033[1;33m  ! %s\033[0m\n' "No Google Maps Map ID — the location picker's marker will show Google's dev-only watermark"
fi

if [ "$DRY_RUN" = false ]; then
  # gcloud prints Python deprecation warnings to stderr on some setups; ignore them.
  active_project="$(gcloud config get-value project 2>/dev/null | tail -1)"
  [ "$active_project" = "$GCP_PROJECT" ] \
    || die "gcloud project is '$active_project', expected '$GCP_PROJECT' (run: gcloud config set project $GCP_PROJECT)"
  gcloud storage ls "$BUCKET/" >/dev/null 2>&1 \
    || die "Cannot list $BUCKET — run 'gcloud auth login' (token expired?) or check permissions"
  ok "gcloud: project $GCP_PROJECT, bucket reachable"
fi

# ── 1. Build ────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = true ]; then
  step "Skipping build (--skip-build)"
  [ -d out ] || die "out/ does not exist — drop --skip-build"
else
  step "Production build"
  # Exported via the shell on purpose: .env.local outranks .env.production,
  # so a file-based override would be silently ignored. Each falls back to
  # its hard-coded PROD_* default only when `.env.prod` didn't already set it.
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-$PROD_API_URL}"
  export NEXT_PUBLIC_DEMO_MODE="${NEXT_PUBLIC_DEMO_MODE:-false}"
  export NEXT_PUBLIC_FIREBASE_API_KEY
  export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-$PROD_FIREBASE_AUTH_DOMAIN}"
  export NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-$PROD_FIREBASE_PROJECT_ID}"
  export NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-$PROD_FIREBASE_APP_ID}"
  export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  export NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

  rm -rf .next out
  pnpm build   # next build + scripts/fix-segment-files.mjs
  ok "build finished"
fi

# ── 2. Sanity checks on out/ ────────────────────────────────────────────────
step "Bundle sanity checks"
[ -f out/vendor/login/index.html ] || die "out/vendor/login/index.html missing — export incomplete"

grep -lq "api.kapzo.in" out/_next/static/chunks/*.js \
  || die "No chunk references api.kapzo.in — NEXT_PUBLIC_API_URL was not applied"
ok "API origin baked in"

if grep -lq "localhost:8080" out/_next/static/chunks/*.js; then
  die "A chunk still references localhost:8080 — .env.local won over the shell env"
fi
ok "no localhost references"

if [ -n "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}" ]; then
  grep -lq "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" out/_next/static/chunks/*.js \
    || die "Google Maps API key was not baked into any chunk"
  ok "Google Maps API key baked in"
fi

nested="$(find out -type d -name '__next.*' | wc -l | tr -d ' ')"
[ "$nested" = "0" ] || die "$nested nested __next.* folder(s) in out/ — scripts/fix-segment-files.mjs did not run"
ok "segment prefetch files are flat"

file_count="$(find out -type f | wc -l | tr -d ' ')"
ok "$file_count files ready in out/"

if [ "$DRY_RUN" = true ]; then
  step "Dry run — nothing uploaded"
  exit 0
fi

# ── 3. Upload ───────────────────────────────────────────────────────────────
step "Uploading out/ → $BUCKET"
gcloud storage rsync out "$BUCKET" --recursive --delete-unmatched-destination-objects 2>&1 \
  | grep -v -i 'FutureWarning\|warnings.warn' || true
ok "rsync complete"

# ── 4. Cache headers ────────────────────────────────────────────────────────
step "Setting cache headers"
gcloud storage objects update "$BUCKET/_next/static/**" \
  --cache-control="public, max-age=31536000, immutable" >/dev/null 2>&1
ok "_next/static/** → immutable"
gcloud storage objects update "$BUCKET/**.html" \
  --cache-control="no-cache, max-age=0, must-revalidate" >/dev/null 2>&1
ok "**.html → no-cache"

# ── 5. Verify live ──────────────────────────────────────────────────────────
step "Verifying $SITE_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$SITE_URL$VERIFY_PATH")"
[ "$code" = "200" ] || die "$SITE_URL$VERIFY_PATH returned $code (expected 200)"
ok "$VERIFY_PATH → 200"

cc="$(curl -sI "$SITE_URL$VERIFY_PATH" | grep -i '^cache-control' | tr -d '\r')"
echo "$cc" | grep -qi 'no-cache' || die "HTML cache-control is wrong: $cc"
ok "HTML is no-cache"

code="$(curl -s -o /dev/null -w '%{http_code}' "$SITE_URL$SEGMENT_CHECK")"
[ "$code" = "200" ] || die "$SEGMENT_CHECK returned $code — segment files missing or not flattened"
ok "segment prefetch file → 200"

live_chunk="$(curl -s "$SITE_URL$VERIFY_PATH" | grep -o '_next/static/chunks/[A-Za-z0-9_.-]*\.js' | head -1)"
[ -n "$live_chunk" ] && [ -f "out/$live_chunk" ] \
  || die "Live HTML references '$live_chunk', which is not in this build"
ok "live HTML serves this build's chunks"

step "Deployed: $SITE_URL"
