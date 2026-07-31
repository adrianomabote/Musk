#!/usr/bin/env bash
# Build script for the replit-assistant service (Expo landing page + QR code).
set -e

echo "==> Node $(node --version), pnpm $(pnpm --version)"

echo "==> Installing dependencies..."
pnpm install \
  --frozen-lockfile \
  --filter "@workspace/assistant..." \
  --config.minimumReleaseAge=0

echo "==> Building static Expo bundle..."
pnpm --filter @workspace/assistant run build

echo "==> Build complete."
