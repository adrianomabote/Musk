#!/usr/bin/env bash
# Build script for the single Replit Assistant service on Render.
# Step 1 – Build the Express API server (TypeScript → ESM).
# Step 2 – Build the static Expo bundle (Metro → static-build/).
#
# Required env vars (set in Render dashboard → Environment):
#   OPENAI_API_KEY      – OpenAI key for the assistant API
#   SESSION_SECRET      – secret for session signing
#   EXPO_PUBLIC_DOMAIN  – the Render service hostname, e.g. replit-assistant.onrender.com
set -e

echo "==> Node $(node --version), pnpm $(pnpm --version)"

# ── 1. API server ─────────────────────────────────────────────────────────────
echo "==> Installing API server dependencies..."
pnpm install \
  --frozen-lockfile \
  --filter "@workspace/api-server..." \
  --config.minimumReleaseAge=0

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

# ── 2. Expo bundle ────────────────────────────────────────────────────────────
if [ -z "${EXPO_PUBLIC_DOMAIN}" ]; then
  echo "==> WARNING: EXPO_PUBLIC_DOMAIN is not set. Skipping Expo build."
  echo "    Set it in the Render dashboard and redeploy to get the landing page."
else
  echo "==> Installing Expo / assistant dependencies..."
  pnpm install \
    --frozen-lockfile \
    --filter "@workspace/assistant..." \
    --config.minimumReleaseAge=0

  echo "==> Building Expo bundle (domain: ${EXPO_PUBLIC_DOMAIN})..."
  pnpm --filter @workspace/assistant run build
fi

echo "==> Build complete."
