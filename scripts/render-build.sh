#!/usr/bin/env bash
set -e

echo "==> Node $(node --version), pnpm $(pnpm --version)"

echo "==> Installing dependencies for api-server..."
pnpm install \
  --frozen-lockfile \
  --filter "@workspace/api-server..." \
  --config.minimumReleaseAge=0

echo "==> Building api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete."
