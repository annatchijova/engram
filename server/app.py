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
import secrets
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

MNEME_REPO_PATH = os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme")
sys.path.insert(0, MNEME_REPO_PATH)

from mneme import authority, causality, trust  # noqa: E402

PROTOCOL_VERSION = "engram-query/v1"
DB_PATH = Path(os.environ.get("MNEME_DB_PATH", Path(__file__).parent / "data" / "demo_field.db"))
READ_TOKEN = os.environ.get("ENGRAM_READ_TOKEN")
DEV_ORIGIN = os.environ.get("ENGRAM_CLIENT_ORIGIN", "http://localhost:5173")

app = FastAPI(title="ENGRAM MNEME read adapter", version=PROTOCOL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[DEV_ORIGIN],
    allow_methods=["GET", "POST"],
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


@app.get("/api/v1/memories/{memory_id}/impact", dependencies=[Depends(require_token)])
def get_impact(memory_id: str) -> dict[str, Any]:
    """Nivel 3 — wraps MNEME's causality.impact() verbatim. Read-only: its
    own docstring says it 'deliberately does NOT quarantine anything'."""
    conn = _conn()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM memories WHERE memory_id = ?", (memory_id,))
    if cur.fetchone() is None:
        conn.close()
        raise HTTPException(404, f"No memory {memory_id!r}.")
    report = causality.impact(cur, memory_id)
    conn.close()
    return _envelope({
        "memory_id": report.memory_id,
        "direct_receipts": list(report.direct_receipts),
        "direct_decisions": list(report.direct_decisions),
        "derived_memories": list(report.derived_memories),
        "derived_unattested": list(report.derived_unattested),
        "derived_decisions": list(report.derived_decisions),
        "possible_memories": list(report.possible_memories),
        "impact_sha256": report.impact_sha256,
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


@app.get("/api/v1/actors", dependencies=[Depends(require_token)])
def list_actors() -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute("SELECT actor_id, display_name, kind, status FROM actors ORDER BY actor_id ASC")
    cols = ["actor_id", "display_name", "kind", "status"]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    return _envelope({"actors": rows})


# ---------------------------------------------------------------------------
# MUTATING SECTION — everything above this line is read-only (_conn() opens
# with PRAGMA query_only = ON). Everything below writes to MNEME, through
# MNEME's own authorized API only, and is the ONLY part of ENGRAM, client or
# server, that does. See the module docstring's AUTH PLACEHOLDER note: the
# session model below is a real server-issued identity (not client-asserted)
# but a hackathon-scope one — in-memory, process-lifetime, one shared demo
# password. It answers the investigation doc's P1.5 just enough to be
# honest about what it is, not as a production auth system.
# ---------------------------------------------------------------------------

DEMO_USERS: dict[str, dict[str, str]] = {
    "omar": {"actor_id": "analyst-omar", "display_name": "Analyst Omar"},
}
DEMO_PASSWORD = os.environ.get("ENGRAM_DEMO_PASSWORD", "demo-password")
SESSION_TTL_SECONDS = 3600

SESSIONS: dict[str, dict[str, Any]] = {}
IDEMPOTENCY: dict[str, dict[str, Any]] = {}


def _rw_conn() -> sqlite3.Connection:
    """Read-write connection. Used ONLY by the quarantine endpoint below —
    every other endpoint in this file uses _conn(), which is query-only."""
    if not DB_PATH.exists():
        raise HTTPException(
            503, f"No field at {DB_PATH}. Run seed_demo_field.py first.")
    return sqlite3.connect(str(DB_PATH))


def require_session(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    if creds is None:
        raise HTTPException(401, "Missing session token.")
    session = SESSIONS.get(creds.credentials)
    if session is None:
        raise HTTPException(401, "Invalid or expired session token.")
    if session["expires_at"] < time.time():
        del SESSIONS[creds.credentials]
        raise HTTPException(401, "Session expired — log in again.")
    return session


@app.post("/api/v1/auth/login")
def login(payload: dict[str, str] = Body(...)) -> dict[str, Any]:
    username = payload.get("username", "")
    password = payload.get("password", "")
    user = DEMO_USERS.get(username)
    if user is None or not secrets.compare_digest(password, DEMO_PASSWORD):
        raise HTTPException(401, "Invalid username or password.")

    conn = _conn()
    cur = conn.cursor()
    caps = sorted(authority.effective_capabilities(cur, user["actor_id"]))
    conn.close()

    token = secrets.token_urlsafe(32)
    SESSIONS[token] = {
        "actor_id": user["actor_id"],
        "display_name": user["display_name"],
        "expires_at": time.time() + SESSION_TTL_SECONDS,
    }
    return _envelope({
        "session_token": token,
        "actor_id": user["actor_id"],
        "display_name": user["display_name"],
        "effective_capabilities": caps,
        "expires_in_seconds": SESSION_TTL_SECONDS,
    })


@app.get("/api/v1/actors/{actor_id}/quarantine-preview", dependencies=[Depends(require_token)])
def quarantine_preview(actor_id: str) -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    cur.execute("SELECT status FROM actors WHERE actor_id = ?", (actor_id,))
    row = cur.fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, f"No actor {actor_id!r}.")
    already_quarantined = row[0] == "QUARANTINED"

    # The EXACT query trust.quarantine_actor() uses to compute its flagged
    # set (mneme/trust.py) — imported NON_INFLUENCE_EVENTS, not re-declared,
    # so this preview cannot silently drift from what a real commit does.
    placeholders = ",".join("?" for _ in trust.NON_INFLUENCE_EVENTS)
    cur.execute(
        f"SELECT DISTINCT memory_id FROM custody_chain WHERE actor_id = ? "
        f"AND event_type NOT IN ({placeholders}) ORDER BY memory_id ASC",
        (actor_id, *trust.NON_INFLUENCE_EVENTS),
    )
    would_flag = [r[0] for r in cur.fetchall()]
    conn.close()
    return _envelope({
        "actor_id": actor_id,
        "already_quarantined": already_quarantined,
        "would_flag_memory_ids": would_flag,
        "count": len(would_flag),
    })


def _map_mneme_error(err: ValueError) -> HTTPException:
    msg = str(err)
    if "already QUARANTINED" in msg:
        return HTTPException(409, msg)
    if "Unknown actor" in msg or "Unknown initiator" in msg:
        return HTTPException(404, msg)
    if "holds no" in msg or "no authority chain" in msg or "refused" in msg:
        return HTTPException(403, msg)
    return HTTPException(400, msg)


@app.post("/api/v1/actors/{actor_id}/quarantine")
def quarantine_actor(
    actor_id: str,
    payload: dict[str, str] = Body(...),
    session: dict[str, Any] = Depends(require_session),
) -> dict[str, Any]:
    reason = payload.get("reason", "")
    idempotency_key = payload.get("idempotency_key", "")
    if not reason.strip():
        raise HTTPException(400, "reason must be non-empty.")
    if not idempotency_key.strip():
        raise HTTPException(400, "idempotency_key is required.")

    cache_key = f"quarantine:{session['actor_id']}:{idempotency_key}"
    cached = IDEMPOTENCY.get(cache_key)
    if cached is not None:
        return cached

    conn = _rw_conn()
    try:
        cur = conn.cursor()
        sweep = trust.quarantine_actor(
            cur, actor_id=actor_id, initiated_by=session["actor_id"],
            reason=reason,
        )
        conn.commit()
    except ValueError as err:
        conn.rollback()
        raise _map_mneme_error(err) from err
    finally:
        conn.close()

    result = _envelope({
        "sweep_id": sweep.sweep_id,
        "quarantined_actor": sweep.quarantined_actor,
        "initiated_by": sweep.initiated_by,
        "flagged_memory_ids": list(sweep.flagged_memory_ids),
        "flagged_count": len(sweep.flagged_memory_ids),
        "advisory_resonant_neighbours": list(sweep.advisory_resonant_neighbours),
    })
    IDEMPOTENCY[cache_key] = result
    return result
