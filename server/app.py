"""ENGRAM — Nivel 1 read adapter over MNEME.

Read-only query gateway. Every value served here comes straight out of
MNEME's own tables or public functions — no custody status, authority
grant, or confidence number is computed here. The adapter's only jobs are:
authenticate the caller, read, and wrap the result in a versioned envelope.

No mutation endpoint exists in this file. That is deliberate, not an
oversight: ENGRAM-ARCHITECTURAL-INVESTIGATION.md's authority boundary
requires an authenticated XR actor identity and a typed command gateway
before any MNEME capability (STORE, QUARANTINE_MEMORY, ...) is reachable
from the client, and that identity binding is still an open question
(P1.5 in the investigation doc). Nivel 1 sidesteps the question instead of
answering it badly: there is nothing here to authorize.

AUTH PLACEHOLDER (named, not hidden): every request needs a static bearer
token from ENGRAM_READ_TOKEN. This is NOT the externally-authenticated
actor identity the architecture calls for — it is a single shared secret
for local hackathon use. It is acceptable only because this file exposes
zero mutating capability: holding the token lets you read the field, and
nothing else.
"""
from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

MNEME_REPO_PATH = os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme")
sys.path.insert(0, MNEME_REPO_PATH)

from mneme import authority  # noqa: E402

PROTOCOL_VERSION = "engram-query/v1"
DB_PATH = Path(os.environ.get("MNEME_DB_PATH", Path(__file__).parent / "data" / "demo_field.db"))
READ_TOKEN = os.environ.get("ENGRAM_READ_TOKEN")
DEV_ORIGIN = os.environ.get("ENGRAM_CLIENT_ORIGIN", "http://localhost:5173")

app = FastAPI(title="ENGRAM MNEME read adapter", version=PROTOCOL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[DEV_ORIGIN],
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)

_bearer = HTTPBearer(auto_error=False)


def require_token(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    if not READ_TOKEN:
        raise HTTPException(500, "ENGRAM_READ_TOKEN is not configured on the server.")
    if creds is None or creds.credentials != READ_TOKEN:
        raise HTTPException(401, "Missing or invalid bearer token.")


def _conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(
            503, f"No field at {DB_PATH}. Run seed_demo_field.py first.")
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA query_only = ON")
    return conn


def _envelope(data: Any) -> dict[str, Any]:
    return {
        "protocol_version": PROTOCOL_VERSION,
        "snapshot_as_of": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


CUSTODY_STATUS_MEANING = {
    "CLEAN": "Servable - visible to recall",
    "TAINT_FLAGGED": "Actor quarantine propagated - invisible, rehabilitable",
    "QUARANTINED": "Direct evidence against this memory - invisible, not rehabilitable",
    "SUPERSEDED": "Replaced by a newer memory - invisible, preserved",
}


@app.get("/api/v1/field/overview", dependencies=[Depends(require_token)])
def field_overview() -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM memories")
    total = cur.fetchone()[0]
    cur.execute("SELECT custody_status, COUNT(*) FROM memories GROUP BY custody_status")
    status_dist = dict(cur.fetchall())
    cur.execute("SELECT field_state, COUNT(*) FROM memories GROUP BY field_state")
    state_dist = dict(cur.fetchall())
    cur.execute("SELECT COUNT(*) FROM actors")
    actors = cur.fetchone()[0]
    ledger = authority.ledger_exists(cur)
    roots = authority.root_subjects(cur) if ledger else []
    conn.close()
    return _envelope({
        "total_memories": total,
        "custody_status_distribution": status_dist,
        "custody_status_meaning": CUSTODY_STATUS_MEANING,
        "field_state_distribution": state_dist,
        "registered_actors": actors,
        "authority_ledger_exists": ledger,
        "root_actors": roots,
        "capability_vocabulary": sorted(authority.CAPABILITIES),
    })


@app.get("/api/v1/memories", dependencies=[Depends(require_token)])
def list_memories(limit: int = Query(50, ge=1, le=200),
                   offset: int = Query(0, ge=0)) -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT memory_id, topic, field_state, custody_status, created_at, "
        "substr(content, 1, 120) AS content_preview "
        "FROM memories ORDER BY created_at ASC, memory_id ASC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    cols = ["memory_id", "topic", "field_state", "custody_status", "created_at",
            "content_preview"]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    cur.execute("SELECT COUNT(*) FROM memories")
    total = cur.fetchone()[0]
    conn.close()
    return _envelope({"total": total, "limit": limit, "offset": offset, "memories": rows})


@app.get("/api/v1/memories/{memory_id}", dependencies=[Depends(require_token)])
def get_memory(memory_id: str) -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT memory_id, content, content_sha256, embedding_model, topic, "
        "created_by, created_at, field_state, custody_status, confidence, "
        "superseded_by FROM memories WHERE memory_id = ?",
        (memory_id,),
    )
    row = cur.fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, f"No memory {memory_id!r}.")
    cols = ["memory_id", "content", "content_sha256", "embedding_model", "topic",
            "created_by", "created_at", "field_state", "custody_status",
            "confidence", "superseded_by"]
    return _envelope(dict(zip(cols, row)))


@app.get("/api/v1/memories/{memory_id}/custody", dependencies=[Depends(require_token)])
def get_custody_chain(memory_id: str) -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT memory_id, seq, event_type, actor_id, reason, created_at, "
        "payload_json, prev_hash, entry_hash FROM custody_chain "
        "WHERE memory_id = ? ORDER BY seq ASC", (memory_id,),
    )
    rows = cur.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, f"No custody chain for {memory_id!r}.")
    cols = ["memory_id", "seq", "event_type", "actor_id", "reason", "created_at",
            "payload_json", "prev_hash", "entry_hash"]
    entries = [dict(zip(cols, r)) for r in rows]
    return _envelope({
        "memory_id": memory_id,
        "chain_length": len(entries),
        "head_hash": entries[-1]["entry_hash"],
        "entries": entries,
    })


@app.get("/api/v1/actors/{actor_id}/authority", dependencies=[Depends(require_token)])
def get_authority(actor_id: str) -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM actors WHERE actor_id = ?", (actor_id,))
    if cur.fetchone() is None:
        conn.close()
        raise HTTPException(404, f"No actor {actor_id!r}.")
    rows = authority.load_authority_rows(cur, actor_id)
    caps = sorted(authority.effective_capabilities(cur, actor_id))
    conn.close()
    return _envelope({
        "actor_id": actor_id,
        "effective_capabilities": caps,
        "chain": rows,
    })
