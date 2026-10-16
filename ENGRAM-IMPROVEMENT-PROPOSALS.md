# ENGRAM — improvement proposals

**Date:** 2026-10-15
**Branch:** `devin-improvement-proposals`
**Reviewer:** AI-assisted static review (no code was executed; findings below
cite the live file and were re-verified against it before being written down).

**Scope of honesty:** this is a source review of `server/app.py` (532 lines),
`client/src/*.ts` (~1,200 lines), `server/README.md`, and
`ENGRAM-ARCHITECTURAL-INVESTIGATION.md`. Nothing was run, deployed, or fuzzed.
Each item names the evidence; anything marked *hypothesis* needs a runtime
check before being treated as a defect.

The codebase is already unusually honest about its own limits (auth
placeholder, process-lifetime `FIELD_VERSION`, no persistent volume — all
named in the code, not hidden). These proposals extend that posture: fix the
few places where reality doesn't match the claims, and harden the seams a
public Fly.io deployment exposes.

---

## A. Defects (verifiable against the live file)

### A1. Verifier subprocess failure produces `NameError`, not an honest status

`server/app.py:515-529` — `r = subprocess.run(...)` runs inside a
`try`/`finally` that unlinks the temp file, but `r.returncode` is read
*after* the block. If `subprocess.run` raises (`TimeoutExpired` at the 30s
limit, `FileNotFoundError` if `VERIFIER_PATH` is missing, `OSError`), `r`
is never bound and the endpoint 500s with `NameError` — the one outcome the
caller can't distinguish from a crash.

Proposal: catch `subprocess.TimeoutExpired` / `OSError` explicitly and return
a verifier block like `{"verified": false, "status": "VERIFIER_UNAVAILABLE",
"exit_code": null}`. A failed verification is a named state, not an
exception — this is exactly the threat-model row "Verification failure →
scene must not keep showing reliable data; state `UNVERIFIED`, no silent
fallback." Right now the adapter's own failure mode is the silent one.

### A2. Read-token check is not constant-time; password check is

`server/app.py:72` compares the bearer token with `!=`, while
`server/app.py:295` correctly uses `secrets.compare_digest` for the demo
password. Same secret class, different treatment.

Proposal: `secrets.compare_digest(creds.credentials, READ_TOKEN)`. One line;
kills the timing side-channel on the read token. Low risk on a demo, but the
fix is free and the inconsistency reads like an oversight rather than a
decision.

### A3. `expected_field_version` of the wrong type is a 500

`server/app.py:382-383` — `int(expected_version)` raises `ValueError` on
`"abc"`, `[1]`, `{}`, etc. FastAPI's `Body(...)` takes `dict[str, Any]`, so a
malformed body turns a client error into a server exception — precisely the
failure mode Nivel 5's stale-snapshot check exists to *explain*, and here it
explains nothing.

Proposal: accept `int` only (`isinstance(expected_version, int) and not
isinstance(expected_version, bool)`), else `400` with a clear message.
Matches the file's own defensive-validation style (`AuthorizationGrant`-like
discipline exists in MNEME; the adapter should not be softer than what it
wraps).

### A4. `SESSIONS` and `IDEMPOTENCY` grow without bound

`server/app.py:263-264` — `SESSIONS` evicts an entry only when that *same*
token is presented after expiry (`app.py:285`); a token that is never
presented again lives forever. `IDEMPOTENCY` is never evicted at all. On the
public Fly deployment every login and every quarantine commit permanently
allocates memory. Small per record, but it's the difference between "demo
scope" and "leak."

Proposal: bound both — e.g., a `maxsize` + TTL sweep on access (drop expired
sessions opportunistically), and cap `IDEMPOTENCY` (FIFO eviction past N
entries) since MNEME's own idempotency guarantee doesn't depend on the cache
being infinite. Name the bound in the response or a comment.

### A5. `DEMO_PASSWORD` has a hardcoded fallback

`server/app.py:260` — `os.environ.get("ENGRAM_DEMO_PASSWORD", "demo-password")`.
On the public deployment, a forgotten env var silently yields a *documented*
default credential (it's in `server/README.md`). The README names the session
model as hackathon-scope; a default credential is one step past that.

Proposal: fail closed — if `ENGRAM_DEMO_PASSWORD` is unset, `login` returns
503 with "login not configured" rather than authenticating against a known
string. Keeps local dev honest without giving the public instance a
guessable password by omission.

---

## B. Hardening / honest-degradation improvements

### B1. No health endpoint on a deployed service

There is no `GET /health` (verified: absent from `app.py`). The adapter is
deployed on Fly.io and the README already documents the "no persistent
volume, reseeds on restart" limitation — a health endpoint is where that
honesty should live at runtime.

Proposal: unauthenticated `GET /health` reporting `{ "status": "ok" |
"degraded", "field_db_present": bool, "read_token_configured": bool,
"mneme_importable": bool, "field_version": n }` — never secrets, never
memory content. Gives Fly real health checks and gives the client a way to
say "the field is empty because it hasn't been seeded" instead of a bare 503.

### B2. `snapshot_as_of` is response time, not a snapshot boundary

`server/app.py:85-90` — `_envelope` stamps `datetime.now()` at response time.
While the only writer is this process that's equivalent, but the field is
labeled *snapshot_as_of* — and the project already cares about the
difference between "declared time" and real ordering (threat-model row
"Timestamp falso"). `FIELD_VERSION` exists precisely as the real boundary.

Proposal: label it what it is (`"served_at"`) or, better, pin the envelope to
`field_version` + the DB file's hashable head state. If a second writer ever
exists, `now()` becomes a false claim silently.

### B3. `FIELD_VERSION` is process-lifetime; the DB outlives it in principle

`server/app.py:53-56` names this honestly already. The concrete hazard: Fly
restart resets `FIELD_VERSION` to 0 while `data/demo_field.db` semantics
continue; a staged commit that should 409 as stale could pass against a
re-zeroed counter — *if* the DB were persisted. Today the DB also reseeds,
so the bug is latent, not live. But it's latent in exactly the shape the
doc's threat model calls out ("XR stale state → snapshot/version
precondition").

Proposal: persist `field_version` in the SQLite field itself (a `meta` table,
or derive it from the custody chain length — `SELECT MAX(seq)`-style, which
is already the authoritative ordering). Then the precondition is true even
across process restarts, and the seed script's version is a real value, not
a coincidence of boot order.

### B4. Client `fetch` has no timeout

`client/src/engram-api.ts` `request()` issues `fetch` with no
`AbortSignal`. In XR a hung request is a hung overlay with no console
visible to the user — and `index.ts` already learned this lesson the hard
way (its comment: "a rejection or a worker-thread error can be invisible to
normal console tooling").

Proposal: `AbortSignal.timeout(15000)` on requests, surfaced as a named
"adapter unreachable/timeout" state in the overlay — same class as B1's
honest health, on the client side.

### B5. Protocol-version mismatch is console-only

`client/src/engram-api.ts` compares `EXPECTED_PROTOCOL_VERSION` and logs on
mismatch — deliberate ("minimal check, not a hard gate"). Cheap upgrade:
surface it as a non-blocking badge in the login overlay ("client/server
protocol skew detected — results may be stale"). The adversarial question it
answers ("can an old client interpret a new protocol?") deserves a visible
answer, not a devtools-only one.

### B6. Session expiry is invisible until it fails

`LoginResult.expires_in_seconds` is returned but never surfaced;
`SessionStore` holds the token past TTL and the operator discovers expiry
only when a commit 401s. On a live demo that's the worst moment to learn it.

Proposal: show "session expires in N min" in `login-overlay.ts` and a
re-login affordance — not a refresh mechanism (correctly out of scope), just
visibility. Pure client-side; the TTL contract is unchanged.

---

## C. Architectural proposals (need a decision, not a patch)

### C1. Read audit for counterfactual widening — the threat model already asks for it

Threat-model row: *"Read audit gap — widened counterfactual no queda
auditado; decidir si ENGRAM necesita read audit adicional."* The
`containment-effect` endpoint (`app.py:473`) is the one read that *discloses*
what custody withheld — the only read that is also an information event.

Proposal: append a local JSONL audit record per widening call
(`actor_id`, timestamp, `query_sha256`, `delta_sha256`) — adapter-local,
no MNEME schema change, honest about its own limits (it's the adapter's
claim it happened, not sealed evidence). If a future MNEME capability can
attest reads, migrate; until then this answers the doc's open question with
the smallest honest artifact.

### C2. Persistent volume or explicit reset semantics

The README owns the limitation ("reseeds a fresh demo field on every
restart"). Two honest options, both cheap:
- **A Fly volume** for `server/data/` — sessions and `FIELD_VERSION` still
  need B3, but the field survives deploys; quarantines stop evaporating.
- **Or name the epoch:** embed a boot token in `/health` and every envelope
  (`"field_epoch": <boot-uuid>`) so a client can tell "the field reset under
  me" from "the field is empty." That is the degradation made legible, which
  may be *better* for the demo than hiding it.

### C3. P1.5 — external actor identity

Open question #5 stays open; the honest intermediate step between "one demo
user" and "real identity" is probably a small set of pre-registered actors
with per-actor passwords (still server-side secrets, still hackathon-grade,
but it exercises the *multi-actor authority paths* in MNEME — which is what
ENGRAM exists to show). One user can't demonstrate that the gate is real;
three users can.

---

## D. Explicitly not proposed

- **Mutation endpoints beyond quarantine.** The investigation doc already
  scopes which MNEME capabilities XR may reach; expanding that surface is a
  design decision (P0/P1 questions), not a code improvement.
- **Real auth (OIDC/external IdP).** Premature for the competition window;
  A5 + C3 covers the honest middle.
- **Quest-specific features** (hand tracking, passthrough, anchors). The doc
  correctly forbids claiming hardware compatibility until tested; none of
  these proposals touch the XR path.
- **Any change to MNEME itself.** Out of scope here; proposals assume the
  adapter boundary stays where it is.

## Priority read

If only three things land before the next deploy: **A1** (verifier crash →
NameError, it's a real bug not a posture issue), **A3** (malformed input →
500 on the one endpoint that writes), **B1** (health endpoint — the
deployment has no legible degraded state). Everything in B/C is additive and
none of it changes the sealed surface or the authority boundary.
