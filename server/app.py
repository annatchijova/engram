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
token from ENGRAM_READ_TOKEN — except GET /health, which is unauthenticated
and reports only whether prerequisites exist (never secrets, never field
content). This is NOT the externally-authenticated
actor identity the architecture calls for — it is a single shared secret
for local hackathon use. It is acceptable only because this file exposes
zero mutating capability: holding the token lets you read the field, and
nothing else.
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

MNEME_REPO_PATH = os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme")
sys.path.insert(0, MNEME_REPO_PATH)

from mneme import authority, bundle, causality, counterfactual, field, trust  # noqa: E402

VERIFIER_PATH = Path(MNEME_REPO_PATH) / "verify_offline.py"

PROTOCOL_VERSION = "engram-query/v1"
DB_PATH = Path(os.environ.get("MNEME_DB_PATH", Path(__file__).parent / "data" / "demo_field.db"))
READ_TOKEN = os.environ.get("ENGRAM_READ_TOKEN")
DEV_ORIGIN = os.environ.get("ENGRAM_CLIENT_ORIGIN", "http://localhost:5173")

# Nivel 5 — the field version is DERIVED from persisted state, not kept in a
# process global: every mutation MNEME exposes through this adapter appends
# custody-chain events, so the entry count grows strictly with each write.
# A staged commit's expected_field_version therefore survives restarts
# instead of resetting to 0 with the process.
def _field_version(cur: sqlite3.Cursor) -> int:
    cur.execute("SELECT COUNT(*) FROM custody_chain")
    return int(cur.fetchone()[0])

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
    if creds is None or not secrets.compare_digest(creds.credentials, READ_TOKEN):
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
        # Wall-clock response time, not a snapshot boundary: named served_at
        # so it is never mistaken for a verified "as-of" marker. The real
        # ordering value a client can stage against is field_version.
        "served_at": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


CUSTODY_STATUS_MEANING = {
    "CLEAN": "Servable - visible to recall",
    "TAINT_FLAGGED": "Actor quarantine propagated - invisible, rehabilitable",
    "QUARANTINED": "Direct evidence against this memory - invisible, not rehabilitable",
    "SUPERSEDED": "Replaced by a newer memory - invisible, preserved",
}


@app.get("/health")
def health() -> dict[str, Any]:
    """Unauthenticated liveness + degradation report.

    Reports only whether prerequisites exist — never secrets, never field
    content. A missing DB or unset read token is a *degraded* service, not a
    silent one: a client can tell "the field was never seeded" from "the
    adapter is down" without holding any credential.
    """
    db_present = DB_PATH.exists()
    field_version: int | None = None
    if db_present:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("PRAGMA query_only = ON")
        try:
            field_version = _field_version(conn.cursor())
        finally:
            conn.close()
    return {
        "status": "ok" if (db_present and READ_TOKEN) else "degraded",
        "protocol_version": PROTOCOL_VERSION,
        "field_db_present": db_present,
        "read_token_configured": bool(READ_TOKEN),
        "demo_password_configured": DEMO_PASSWORD is not None,
        "field_version": field_version,
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
    field_version = _field_version(cur)
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
        "field_version": field_version,
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
# Fail-closed: no default password. If the variable is unset, login refuses
# with 503 instead of authenticating against a value published in the README.
DEMO_PASSWORD = os.environ.get("ENGRAM_DEMO_PASSWORD")
SESSION_TTL_SECONDS = 3600

# In-memory maps bounded explicitly: SESSIONS evicts expired entries on every
# access and is hard-capped; IDEMPOTENCY is FIFO-capped. An evicted
# idempotency key does not cause a double effect — MNEME's own
# "already QUARANTINED" refusal is the durable dedup, the cache only saves
# the replay the round-trip.
SESSIONS_MAX = 64
IDEMPOTENCY_MAX = 256
SESSIONS: dict[str, dict[str, Any]] = {}
IDEMPOTENCY: dict[str, dict[str, Any]] = {}


def _sweep_sessions() -> None:
    now = time.time()
    for token in [t for t, s in SESSIONS.items() if s["expires_at"] < now]:
        del SESSIONS[token]
    if len(SESSIONS) > SESSIONS_MAX:
        oldest_first = sorted(SESSIONS, key=lambda t: SESSIONS[t]["expires_at"])
        for token in oldest_first[: len(SESSIONS) - SESSIONS_MAX]:
            del SESSIONS[token]


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
    _sweep_sessions()
    session = SESSIONS.get(creds.credentials)
    if session is None:
        raise HTTPException(401, "Invalid or expired session token.")
    if session["expires_at"] < time.time():
        del SESSIONS[creds.credentials]
        raise HTTPException(401, "Session expired — log in again.")
    return session


@app.post("/api/v1/auth/login")
def login(payload: dict[str, str] = Body(...)) -> dict[str, Any]:
    if DEMO_PASSWORD is None:
        raise HTTPException(
            503,
            "Login is not configured on this server "
            "(ENGRAM_DEMO_PASSWORD unset) — refusing rather than "
            "authenticating against a default credential.",
        )
    username = payload.get("username", "")
    password = payload.get("password", "")
    user = DEMO_USERS.get(username)
    if user is None or not secrets.compare_digest(password, DEMO_PASSWORD):
        raise HTTPException(401, "Invalid username or password.")

    _sweep_sessions()

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
    field_version = _field_version(cur)
    conn.close()
    return _envelope({
        "actor_id": actor_id,
        "already_quarantined": already_quarantined,
        "would_flag_memory_ids": would_flag,
        "count": len(would_flag),
        "field_version": field_version,
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
    payload: dict[str, Any] = Body(...),
    session: dict[str, Any] = Depends(require_session),
) -> dict[str, Any]:
    reason = payload.get("reason", "")
    idempotency_key = payload.get("idempotency_key", "")
    if not reason.strip():
        raise HTTPException(400, "reason must be non-empty.")
    if not idempotency_key.strip():
        raise HTTPException(400, "idempotency_key is required.")

    expected_version = payload.get("expected_field_version")
    if expected_version is not None and (
        isinstance(expected_version, bool)
        or not isinstance(expected_version, int)
    ):
        raise HTTPException(
            400, "expected_field_version must be an integer when present.")

    cache_key = f"quarantine:{session['actor_id']}:{idempotency_key}"
    cached = IDEMPOTENCY.get(cache_key)
    if cached is not None:
        return cached

    conn = _rw_conn()
    try:
        cur = conn.cursor()
        # Stale-snapshot precondition (Nivel 5): checked against the
        # PERSISTED version inside the same transaction as the mutation,
        # and worded distinctly from "already QUARANTINED" so an operator
        # can tell "the world moved under you" from "someone already did
        # this."
        current_version = _field_version(cur)
        if expected_version is not None and expected_version != current_version:
            raise HTTPException(
                409,
                f"stale snapshot: field is now at version {current_version}, "
                f"you staged against version {expected_version} — refresh "
                "and restage.",
            )
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
    if len(IDEMPOTENCY) >= IDEMPOTENCY_MAX:
        # dict is insertion-ordered: evict the oldest entry first.
        del IDEMPOTENCY[next(iter(IDEMPOTENCY))]
    IDEMPOTENCY[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# COUNTERFACTUAL SECTION — read-only (compare_worlds only ever calls the
# read-only field.recall() twice and diffs the results; _conn() stays
# query-only for both endpoints below, same as every other GET in this
# file). containment-effect is session-gated anyway, not because it writes,
# but because WIDENING a custody override discloses what the gate withheld
# — field.recall()'s own authority check (mneme/field.py) is what actually
# enforces this; this adapter only supplies the actor_id the check needs.
# ---------------------------------------------------------------------------

# Same literals the seed script already uses (server/seed_demo_field.py's
# `e([...])` calls) so the query hashes below match the persisted Nivel 3
# receipt exactly — these are not arbitrary demo inputs, they're the two
# queries that already have real meaning in the seeded incident.
DEMO_NEAR_POISON_QUERY = [0.97, 0.02, 0.0]
DEMO_NEAR_TRUE_POLICY_QUERY = [1.0, 0.2, 0.0]


def _delta_envelope(delta) -> dict[str, Any]:
    return _envelope({
        "query_sha256": delta.query_sha256,
        "top_k": delta.top_k,
        "hops": delta.hops,
        "world_a_override": [list(p) for p in delta.world_a_override],
        "world_b_override": [list(p) for p in delta.world_b_override],
        "served_a": list(delta.served_a),
        "served_b": list(delta.served_b),
        "receipt_a_sha256": delta.receipt_a_sha256,
        "receipt_b_sha256": delta.receipt_b_sha256,
        "removed_from_serving": list(delta.removed_from_serving),
        "entered_top_k": list(delta.entered_top_k),
        "rank_changed": [list(x) for x in delta.rank_changed],
        "score_changed": [list(x) for x in delta.score_changed],
        "claim_outcome_changed": [list(x) for x in delta.claim_outcome_changed],
        "decision_dependency_changed": list(delta.decision_dependency_changed),
        "interference": delta.interference,
        "summary": delta.summary(),
        "delta_sha256": delta.delta_sha256,
    })


@app.get("/api/v1/counterfactual/exclusion-effect", dependencies=[Depends(require_token)])
def exclusion_effect() -> dict[str, Any]:
    """Narrowing only — no COUNTERFACTUAL capability needed, by MNEME's
    own design: this can only ever show the caller less than it could
    already see."""
    conn = _conn()
    cur = conn.cursor()
    delta = counterfactual.exclusion_effect(
        cur, query_embedding=field.quantize_embedding(DEMO_NEAR_TRUE_POLICY_QUERY),
        excluded=["mem-gate"],
    )
    conn.close()
    return _delta_envelope(delta)


@app.get("/api/v1/counterfactual/containment-effect")
def containment_effect(session: dict[str, Any] = Depends(require_session)) -> dict[str, Any]:
    """Widening — forces mem-poison back to CLEAN to see what it would
    have shown. MNEME's authority.gate rejects a session actor lacking
    COUNTERFACTUAL; this adapter does not duplicate that check."""
    conn = _conn()
    cur = conn.cursor()
    try:
        delta = counterfactual.containment_effect(
            cur, query_embedding=field.quantize_embedding(DEMO_NEAR_POISON_QUERY),
            contained=["mem-poison"], actor_id=session["actor_id"],
        )
    except ValueError as err:
        conn.close()
        raise _map_mneme_error(err) from err
    conn.close()
    return _delta_envelope(delta)


# ---------------------------------------------------------------------------
# NIVEL 5 — bundle export + INDEPENDENT offline verification. The verifier
# runs as a genuinely separate subprocess (mneme/verify_offline.py), never
# an in-process function call — mirroring mneme/demo.py's own
# run_verifier() — because a bundle's writer must never also be its only
# checker. Read-only: export_bundle() and the standalone verifier both only
# read the field.
# ---------------------------------------------------------------------------

@app.get("/api/v1/bundle/export", dependencies=[Depends(require_token)])
def export_bundle() -> dict[str, Any]:
    conn = _conn()
    cur = conn.cursor()
    bundle_json = bundle.export_bundle(cur)
    conn.close()

    outer = json.loads(bundle_json)
    memory_count = len(outer.get("body", {}).get("memories", []))

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(bundle_json)
        tmp_path = f.name
    try:
        r = subprocess.run(
            [sys.executable, str(VERIFIER_PATH), tmp_path],
            capture_output=True, text=True, timeout=30,
        )
        verifier = {
            "verified": r.returncode == 0,
            "exit_code": r.returncode,
            "status": "VERIFIED" if r.returncode == 0 else "REJECTED",
            "output_lines": (r.stdout.strip() or r.stderr.strip()).splitlines(),
        }
    except (subprocess.TimeoutExpired, OSError) as err:
        # A verifier that never ran is a named state, not a crash: the
        # bundle may be fine, but the client must see VERIFIER_UNAVAILABLE,
        # not a 500 it can't distinguish from a corrupted export.
        verifier = {
            "verified": False,
            "exit_code": None,
            "status": "VERIFIER_UNAVAILABLE",
            "output_lines": [f"{type(err).__name__}: {err}"],
        }
    finally:
        os.unlink(tmp_path)

    return _envelope({
        "bundle_json": bundle_json,
        "bundle_sha256": outer.get("bundle_sha256"),
        "memory_count": memory_count,
        "verifier": verifier,
    })
