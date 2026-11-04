#!/usr/bin/env bash
# ENGRAM local development: adapter (MNEME gateway) + Vite client.
# Run from anywhere: ./scripts/dev-local.sh
# Adapter: http://localhost:8000  |  Canvas: https://localhost:8081/canvas.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ENGRAM_READ_TOKEN="${ENGRAM_READ_TOKEN:-devtoken123}"
export ENGRAM_DEMO_PASSWORD="${ENGRAM_DEMO_PASSWORD:-demo-password}"
export ENGRAM_CLIENT_ORIGIN="${ENGRAM_CLIENT_ORIGIN:-https://localhost:8081,http://localhost:8081}"
PORT="${ENGRAM_ADAPTER_PORT:-8000}"
export VITE_ENGRAM_API_BASE="http://localhost:$PORT"
export VITE_ENGRAM_READ_TOKEN="$ENGRAM_READ_TOKEN"

# A foreign service on the port also answers /health — require ENGRAM identity.
health_now() { curl -s "http://localhost:$PORT/health" 2>/dev/null || true; }
is_engram() { python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("protocol_version")=="engram-query/v1" else 1)' 2>/dev/null; }
if health_now | is_engram; then
  echo "ENGRAM adapter already running on :$PORT — reusing it."
  ADAPTER_PID=""
elif [ -n "$(health_now)" ]; then
  echo "Port $PORT is held by a service that is not the ENGRAM adapter:" >&2
  health_now >&2; echo >&2
  echo "Free the port, or rerun with ENGRAM_ADAPTER_PORT=<free port>." >&2; exit 1
fi

[ -d "${MNEME_REPO_PATH:-/home/labestiadevigia/mneme}/mneme" ] || {
  echo "MNEME sibling repo not found (MNEME_REPO_PATH). The adapter imports it at startup." >&2; exit 1; }
[ -f "$ROOT/server/data/demo_field.db" ] || {
  echo "Seeding demo field..."; (cd "$ROOT/server" && python3 seed_demo_field.py); }

if [ -z "${ADAPTER_PID:-}" ]; then
  (cd "$ROOT/server" && python3 -m uvicorn app:app --port "$PORT") &
  ADAPTER_PID=$!
  trap 'kill $ADAPTER_PID 2>/dev/null || true' EXIT
  for i in $(seq 1 30); do
    if health_now | is_engram; then break; fi
    if [ "$i" = 30 ]; then echo "Adapter did not become healthy on :$PORT" >&2; exit 1; fi
    sleep 1
  done
fi
echo "Adapter healthy: $(health_now)"
ENGRAM_READ_TOKEN="$ENGRAM_READ_TOKEN" python3 "$ROOT/scripts/readiness.py" "http://localhost:$PORT" || true
echo "Open https://localhost:8081/canvas.html (accept the local dev certificate once)."
# A previous IWSDK dev runtime for this workspace blocks a fresh one.
(cd "$ROOT/client" && npm run dev:down >/dev/null 2>&1 || true)
cd "$ROOT/client" && npm run dev:runtime
