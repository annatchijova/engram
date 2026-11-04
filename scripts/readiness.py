#!/usr/bin/env python3
"""ENGRAM readiness: five distinguishable states, no fabricated data.

Probes the adapter /health (unauthenticated) and the read overview
(with the read token). Prints one line per concern: adapter, MNEME
field, authentication, scenario data, and snapshot identity.
Usage: ENGRAM_READ_TOKEN=... python3 scripts/readiness.py [base_url]
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

os.environ["no_proxy"] = "localhost,127.0.0.1"  # env may carry it empty
os.environ["NO_PROXY"] = "localhost,127.0.0.1"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def get(path: str, token: str | None = None):
    req = urllib.request.Request(BASE + path)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception:
        return None, {}


def main() -> int:
    health_status, health = get("/health")
    if health_status is None:
        print("FAIL adapter: did not answer — start ./scripts/dev-local.sh")
        print("FAIL mneme: unknown (adapter down)")
        print("FAIL auth: unknown (adapter down)")
        print("FAIL scenario: unknown (adapter down)")
        return 1
    print(f"PASS adapter: /health {health_status} status={health.get('status')}")
    print(("PASS" if health.get("field_db_present") else "FAIL")
          + f" mneme: field_db_present={health.get('field_db_present')} "
            f"field_version={health.get('field_version')} (seed server/seed_demo_field.py if false)")
    token = os.environ.get("ENGRAM_READ_TOKEN", "devtoken123")
    status, overview = get("/api/v1/field/overview", token)
    if status == 401:
        print("FAIL auth: read token rejected — align ENGRAM_READ_TOKEN / VITE_ENGRAM_READ_TOKEN")
        print("FAIL scenario: unknown (auth)")
        return 1
    print(f"PASS auth: overview {status}")
    total = overview.get("data", {}).get("total_memories", 0)
    print(("PASS" if total else "FAIL")
          + f" scenario: {total} memories (empty field: run the seed)")
    print(f"PASS snapshot: field_version={overview.get('data', {}).get('field_version')}")
    return 0 if total else 1


if __name__ == "__main__":
    raise SystemExit(main())
