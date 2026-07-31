#!/usr/bin/env bash
# Build script for the replit-assistant service (Expo landing page + QR code).
# Runs on Render's free tier (512 MB RAM). Metro is capped at 400 MB heap and
# limited to 1 transformer worker to avoid OOM.
set -e

echo "==> Node $(node --version), pnpm $(pnpm --version)"

echo "==> Installing dependencies..."
pnpm install \
  --frozen-lockfile \
  --filter "@workspace/assistant..." \
  --config.minimumReleaseAge=0

echo "==> Building static Expo bundle..."
# NODE_OPTIONS and METRO_MAX_WORKERS are also set inside build.js, but
# setting them here ensures they propagate to any child processes too.
export NODE_OPTIONS="--max-old-space-size=400"
export METRO_MAX_WORKERS=1

pnpm --filter @workspace/assistant run build

echo "==> Build complete."
