#!/bin/bash
# Build & launch OpenClaw Desktop (dev mode)
# Builds backend + frontend, copies both into desktop/gateway, then launches Electron
# Usage: ./scripts/desktop-dev.sh
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "==> 1/4 Building backend + frontend..."
pnpm build

echo "==> 2/4 Building frontend UI..."
pnpm ui:build

echo "==> 3/4 Syncing backend + UI into desktop/gateway..."
# Backend: copy dist (excluding control-ui) into desktop gateway
rsync -a --delete --exclude='control-ui' dist/ desktop/gateway/dist/
# Frontend: copy control-ui
rm -rf desktop/gateway/dist/control-ui
cp -r dist/control-ui desktop/gateway/dist/control-ui
echo "    Backend + UI synced."

echo "==> 4/4 Launching Desktop (dev)..."
cd desktop
OPENCLAW_DEV=1 npm start
