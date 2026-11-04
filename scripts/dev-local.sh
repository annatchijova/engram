#!/usr/bin/env bash
# ENGRAM local development: adapter (MNEME gateway) + Vite client.
# Run from anywhere: ./scripts/dev-local.sh
# Adapter: http://localhost:8000  |  Canvas: https://localhost:8081/canvas.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ENGRAM_READ_TOKEN="${ENGRAM_READ_TOKEN:-devtoken123}"
export ENGRAM_DEMO_PASSWORD="${ENGRAM_DEMO_PASSWORD:-demo-password}"
export ENGRAM_CLIENT_ORIGIN="${ENGRAM_CLIENT_ORIGIN:-https://localhost:8081,http://localhost:8081}"
export VITE_ENGRAM_API_BASE="http://localhost:8000"
export VITE_ENGRAM_READ_TOKEN="$ENGRAM_READ_TOKEN"

[ -d "${MNEME_REPO_PATH:-/home/labestiadevigia/mneme}/mneme" ] || {
  echo "MNEME sibling repo not found (MNEME_REPO_PATH). The adapter imports it at startup." >&2; exit 1; }
[ -f "$ROOT/server/data/demo_field.db" ] || {
  echo "Seeding demo field..."; (cd "$ROOT/server" && python3 seed_demo_field.py); }

(cd "$ROOT/server" && python3 -m uvicorn app:app --port 8000) &
ADAPTER_PID=$!
trap 'kill $ADAPTER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then break; fi
  if [ "$i" = 30 ]; then echo "Adapter did not become healthy on :8000" >&2; exit 1; fi
  sleep 1
done
echo "Adapter healthy: $(curl -s http://localhost:8000/health)"
ENGRAM_READ_TOKEN="$ENGRAM_READ_TOKEN" python3 "$ROOT/scripts/readiness.py" || true
echo "Open https://localhost:8081/canvas.html (accept the local dev certificate once)."
cd "$ROOT/client" && npm run dev:runtime
