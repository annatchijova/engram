#!/usr/bin/env python3
"""ENGRAM adapter regression probes against a throwaway seeded field.

Spawns the real adapter on a temp MNEME_DB_PATH, then asserts:
unauthenticated 401, actor-vs-memory 404, preview does not mutate,
stale commit 409, unauthorized widening 403, authorized widening 200,
and bundle tamper detection via MNEME's independent verifier.
The live demo field is never touched. Exit 0 = all PASS.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

os.environ["no_proxy"] = "localhost,127.0.0.1"  # env may carry it empty
os.environ["NO_PROXY"] = "localhost,127.0.0.1"
ROOT = Path(__file__).resolve().parent.parent
PORT = 8123
BASE = f"http://127.0.0.1:{PORT}"
TOK = "dev" + "token123"
RESULTS: list[tuple[str, bool]] = []


def check(name: str, ok: bool) -> None:
    RESULTS.append((name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}")


def call(method: str, path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body else None)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read() or b"{}"
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {}
    except urllib.error.URLError:
        return None, {}


def main() -> int:
    db = Path("/tmp/engram-adapter-test.db")
    env = {**os.environ, "MNEME_DB_PATH": str(db),
           "ENGRAM_READ_TOKEN": TOK, "ENGRAM_DEMO_PASSWORD": "demo-password",
           "ENGRAM_CLIENT_ORIGIN": "https://localhost:8081"}
    subprocess.run([sys.executable, str(ROOT / "server" / "seed_demo_field.py"), "--reset"],
                   check=True, env=env, capture_output=True, text=True)
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--port", str(PORT)],
        cwd=ROOT / "server", env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            status, _ = call("GET", "/health")
            if status == 200:
                break
            time.sleep(1)
        s, ov = call("GET", "/api/v1/field/overview", TOK)
        fv = ov["data"]["field_version"]
        check("unauthenticated read is 401", call("GET", "/api/v1/field/overview")[0] == 401)
        check("memory id against actor endpoint is 404",
              call("GET", "/api/v1/actors/mem-poison/quarantine-preview", TOK)[0] == 404)
        s, prev = call("GET", "/api/v1/actors/pipeline-logs/quarantine-preview", TOK)
        check("preview stages without mutating",
              s == 200 and call("GET", "/health")[1]["field_version"] == fv)
        _, login = call("POST", "/api/v1/auth/login",
                        body={"username": "omar", "password": "demo-password"})
        omar = login["data"]["session_token"]
        check("stale commit is 409",
              call("POST", "/api/v1/actors/pipeline-logs/quarantine", omar,
                   {"reason": "probe", "idempotency_key": "t-stale",
                    "expected_field_version": 1})[0] == 409)
        _, login2 = call("POST", "/api/v1/auth/login",
                         body={"username": "ada", "password": "demo-password"})
        ada = login2["data"]["session_token"]
        check("unauthorized widening is 403 (field unchanged)",
              call("GET", "/api/v1/counterfactual/containment-effect", ada)[0] == 403
              and call("GET", "/health")[1]["field_version"] == fv)
        s, cf = call("GET", "/api/v1/counterfactual/containment-effect", omar)
        check("authorized widening is 200 and audited",
              s == 200 and cf["data"].get("read_audit") == "RECORDED")
        s, bundle = call("GET", "/api/v1/bundle/export", TOK)
        check("bundle verifies on the seeded scenario",
              s == 200 and bundle["data"]["verifier"]["status"] == "VERIFIED")
        tampered = json.loads(bundle["data"]["bundle_json"])
        tampered["body"]["memories"][0]["content"] = "tampered content"
        p = Path("/tmp/engram-tampered-bundle.json")
        p.write_text(json.dumps(tampered))
        mneme = os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme")
        v = subprocess.run([sys.executable, f"{mneme}/verify_offline.py", str(p)],
                           capture_output=True, text=True)
        check("tampered bundle is rejected by the independent verifier", v.returncode != 0)
    finally:
        proc.terminate()
    return 0 if all(ok for _, ok in RESULTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
