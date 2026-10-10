# ENGRAM server — Nivel 1-5 adapter

FastAPI gateway over MNEME (`/home/labestiadevigia/mneme` by default).
Nearly every endpoint is read-only — see `app.py`'s module docstring. The
one exception, `POST /api/v1/actors/{id}/quarantine`, is clearly bannered
in the file and is the only place anything in ENGRAM writes to MNEME.

## Run

```sh
pip install -r requirements.txt

# 1. seed a demo field (only needs to be done once; uses MNEME's real
#    authorized API — bootstrap/store/reinforce/supersede/quarantine)
python3 seed_demo_field.py

# 2. start the adapter
ENGRAM_READ_TOKEN=devtoken123 \
ENGRAM_CLIENT_ORIGIN=https://localhost:8081 \
ENGRAM_DEMO_PASSWORD=demo-password \
python3 -m uvicorn app:app --port 8000
```

`ENGRAM_CLIENT_ORIGIN` must match exactly where `npm run dev` serves the
client from (IWSDK's dev server defaults to `https://localhost:8081`, not
`http://` — the scheme matters for CORS). `ENGRAM_READ_TOKEN` must match
`client/.env`'s `VITE_ENGRAM_READ_TOKEN`.

Re-run `seed_demo_field.py --reset` to wipe `data/demo_field.db` and seed a
fresh field; without `--reset` it refuses to touch a non-empty field. The
seeded `pipeline-logs` actor is left CLEAN on purpose — it's the Nivel 2
live-demo quarantine target.

## Nivel 2 — Audited Containment

- `POST /api/v1/auth/login` — demo credentials only: username `omar`,
  password `ENGRAM_DEMO_PASSWORD`. Issues a session token bound to the
  real MNEME actor `analyst-omar`, separate from `ENGRAM_READ_TOKEN`.
  **Known limitation, not hidden**: in-memory sessions, one shared demo
  password, no refresh/expiry UX — a real external-identity binding is
  still open (investigation doc, P1.5).
- `GET /api/v1/actors/{id}/quarantine-preview` — read-only; runs the exact
  query MNEME's `trust.quarantine_actor` uses, so the preview can never
  drift from what a commit actually does.
- `POST /api/v1/actors/{id}/quarantine` — session-token authenticated,
  idempotent (same `idempotency_key` replays the cached result instead of
  double-sweeping), calls MNEME's real `trust.quarantine_actor`. MNEME's
  own `authority.gate` rejects an initiator without `QUARANTINE_ACTOR` —
  that check happens inside MNEME, not in this adapter.

Out of scope this slice: rehabilitate, direct memory quarantine, session
refresh, concurrent-operator conflict handling.

## Nivel 3 — Causal Field

- `GET /api/v1/memories/{id}/impact` — read-only, wraps MNEME's
  `causality.impact()` verbatim (its own docstring: "deliberately does NOT
  quarantine anything"). Returns `direct_receipts`, `direct_decisions`,
  `derived_memories`, `derived_unattested`, `derived_decisions`,
  `possible_memories`, `impact_sha256`.
- The seed script now also persists one recall receipt and records one
  decision citing `mem-poison` (mirrors `mneme/demo.py`'s own narration),
  plus a `mem-note` memory declaring `derived_from_decision` — without
  this, `impact()` would have nothing DIRECT or DERIVED to show except the
  one supersession already in the field.

Out of scope this slice: `/api/v1/receipts/{sha}` and
`/api/v1/decisions/{id}` detail endpoints (markers are visual-only for
now), claims/standing (no claims exist in the seed field yet).

## Nivel 4 — Counterfactual Chambers

MNEME's `counterfactual.compare_worlds()` runs `field.recall` twice
(explicitly read-only) and diffs the results — neither endpoint below
writes, and both use the same query-only `_conn()` every other GET uses.

- `GET /api/v1/counterfactual/exclusion-effect` — bearer `ENGRAM_READ_TOKEN`
  only. Narrowing-only override (`mem-gate` forced `QUARANTINED`) against
  the near-TRUE-policy query — MNEME's own design needs no capability for
  this: it can only ever show the caller less than it could already see.
- `GET /api/v1/counterfactual/containment-effect` — session-token
  authenticated (same `require_session` dependency Nivel 2 already uses).
  Widening override (`mem-poison` forced `CLEAN`) against the near-poison
  query — MNEME's own `authority.gate`, inside `field.recall`, is what
  actually rejects a session actor lacking `COUNTERFACTUAL`; this adapter
  only supplies the `actor_id` the check needs.

Both demo queries are the same literals the seed script already uses, so
their query hashes match the persisted Nivel 3 receipt exactly — not
arbitrary inputs. Both responses include the full sealed delta: served
sets for both worlds, removed/entered/reranked/rescored/claim-flip lists,
`decision_dependency_changed` (reported separately — a field-wide fact,
never folded into the query-scoped interference verdict, per
`CounterfactualDelta.summary()`'s own discipline), and `delta_sha256`.

Out of scope this slice: arbitrary query/target input (no embedding-input
UI), a full dual-world field renderer (the client renders the delta as a
spatially distinct "ghost" cluster, not two complete independent fields).

## Nivel 5 — Portable Epistemic Instrument (first slice)

Two unrelated additions, chosen as the first honest slice of a level that
is really several (multi-user backend, concurrency, bundle handoff,
offline verification, device integration):

- `GET /api/v1/bundle/export` — exports the whole field with MNEME's real
  `bundle.export_bundle()`, then verifies it with MNEME's **genuinely
  separate** `verify_offline.py`, run as a `subprocess` (mirroring
  `mneme/demo.py`'s own `run_verifier()`) — never an in-process function
  call, because a bundle's writer must never also be its only checker.
  Returns the bundle JSON, its own declared `bundle_sha256`, and the
  verifier's real stdout/exit code.
- **Stale-snapshot rejection**: a process-lifetime `FIELD_VERSION` counter
  (named honestly as single-process, not durable — a real multi-instance
  deployment needs this in the DB) is now in `field/overview` and
  `quarantine-preview`'s responses. `POST .../quarantine` requires
  `expected_field_version` and rejects a stale one with 409, worded
  distinctly from "already QUARANTINED" — checked before MNEME is ever
  called.

**Already true, not rebuilt for this slice**: the existing
`_rw_conn()` + `commit()`/`rollback()` transaction already answers "what
if the network drops mid-commit" — atomicity was never the gap.

Out of scope this slice (a deferral, not a silent gap): true concurrent
multi-operator sessions (the version counter guards against stale clients,
not against two simultaneous ones racing each other), physical device
pairing/integration testing, importing or re-verifying a bundle produced
elsewhere, and any protocol-version negotiation beyond the client's
`console.warn` on mismatch (`client/src/engram-api.ts`).

## Deploy (Fly.io)

```sh
export FLYCTL_INSTALL="$HOME/.fly" && export PATH="$FLYCTL_INSTALL/bin:$PATH"
fly auth login             # first time only, opens a browser
fly launch --no-deploy     # first time only, creates the app from fly.toml
fly secrets set \
  ENGRAM_READ_TOKEN=<token> \
  ENGRAM_DEMO_PASSWORD=<password> \
  ENGRAM_CLIENT_ORIGIN=<the deployed client's https URL>
fly deploy
```

The `Dockerfile` clones MNEME from its public GitHub mirror
(`github.com/annatchijova/mneme`) at a pinned commit (`ARG MNEME_COMMIT`
at the top of the file) rather than vendoring a copy — re-pin that build
arg (and rebuild) when the sibling MNEME checkout moves to a commit the
deployed adapter should pick up.

**Named tradeoff**: no persistent volume. The field reseeds fresh on
every boot (`seed_demo_field.py` is idempotent — a no-op against a
non-empty field) rather than persisting across restarts, so a live
quarantine/export demo resets on redeploy. Acceptable for a competition
demo; would need a Fly volume (or an external DB) for real persistence.
