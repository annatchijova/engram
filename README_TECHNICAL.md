[English](README.md) · [Español](README.es.md) · [Technical README](README_TECHNICAL.md)

# ENGRAM — Technical README

This document is the unsoftened engineering account of ENGRAM. The primary
[README](README.md) is written for a human reader and a hackathon jury; the
[Spanish README](README.es.md) is its Spanish adaptation. This document is for
someone who wants to audit, extend, run, or challenge the implementation.

## Technical position

ENGRAM is a browser and WebXR investigation surface over MNEME, a separate
computational-memory engine. ENGRAM does not claim authority over memory. The
adapter reads and presents MNEME state, and exposes one intentionally narrow
mutation path: an authorized actor can quarantine an actor. MNEME remains the
authority for authorization, custody transitions, causal impact,
counterfactual rules, and bundle verification.

The central architectural claim is therefore bounded:

> ENGRAM makes selected MNEME memory operations spatially inspectable and
> operable, while keeping authoritative state and authorization in MNEME.

It is not a general memory product, a production multi-user service, a
forensic certification system, or evidence that researchers prefer VR. Those
claims remain unproven or out of scope.

## Current status

### Implemented

- A conventional browser Canvas and a seated WebXR/IWSDK observatory read the
  same adapter-backed field.
- The field renders memories with custody status, authority information,
  provenance chains, and typed causal relationships.
- The investigator can select a memory, inspect its record and custody chain,
  and request MNEME's `causality.impact()` result.
- Counterfactual endpoints compare bounded read-only worlds. The client
  renders their delta in a spatially separate chamber rather than recolouring
  factual state.
- The containment flow stages a read-only quarantine preview and commits only
  after an explicit authorized action. A stale `field_version` is rejected.
- Bundle export invokes MNEME's `bundle.export_bundle()` and runs
  `verify_offline.py` as a separate subprocess. The client displays the
  verifier's stdout and exit code.
- A guided first-contact tour exposes technical surfaces as questions are
  answered. Free exploration remains available.
- The repository includes a synthetic seed field and reproducible local
  checks.

### Evidence currently available

The strongest current evidence is repository-local and environment-scoped:

| Evidence | Observed result | Scope |
|---|---|---|
| `docs/XR-AUDIT-ROUND11.md` | Guided emulated XR tour 12/12; flat-screen controls 2/2; free loop 15/15 | IWER Quest 3 emulator and desktop browser |
| `docs/XR-RELEASE-CANDIDATE-ROUND12.md` | Guided 12/12 and free exploration 15/15 observed; suites reported PASS | Release-candidate environment described in the report |
| `npm run typecheck` | PASS | Client checkout used for the cited round |
| `npm test` | PASS, 41/41 in Round 12 | Client checkout used for the cited round |
| `npm run build` | PASS | Client checkout used for the cited round |
| `scripts/test-adapter.py` | PASS, 8/8 in cited round | Throwaway adapter field |
| `scripts/readiness.py` | PASS, 5/5 in cited round | Readiness checks in cited round |
| `docs/SECURITY-ROUND4.md` | Tampered bundle rejected; 8/8 PASS | The security round's test fixture |

These records are evidence of the checks they name. They are not a universal
correctness proof, a physical-device certification, or a user study. Before a
submission, rerun them against the exact commit being submitted and update
this table if the outputs differ.

## System boundaries

```text
browser / WebXR client
        |
        | HTTPS + bearer read token or short-lived demo session
        v
ENGRAM FastAPI adapter
        |
        | MNEME authorized API; query-only connections for reads
        v
MNEME field, custody chains, authority, receipts, decisions
```

The browser never opens MNEME's SQLite database. `client/src/engram-api.ts` is
the client-side API boundary. `server/app.py` is the adapter boundary. The
adapter has read endpoints for field, memory, custody, impact, counterfactual,
health, and bundle export. The only write endpoint in this slice is
`POST /api/v1/actors/{id}/quarantine`.

The public read token is not a secret once baked into a static browser bundle.
The design relies on the fact that the token authorizes only read operations.
This is an explicit deployment tradeoff, not a credential-management success.

## Client architecture

`client/src/index.ts` builds the procedural seated observatory and registers
the application systems. The scene does not depend on external art assets for
its geometry, materials, lighting, or in-world glyphs.

| System | Responsibility | Authority/data source |
|---|---|---|
| `field-system.ts` | Fetches and lays out the memory field; applies the custody palette | `/api/v1/field/overview`, `/api/v1/memories` |
| `selection-system.ts` | Fetches record and custody chain for a selected memory | Memory and custody endpoints |
| `custody-chain-system.ts` | Displays ordered hash-linked custody events | Selected record response |
| `trace-system.ts` | Draws typed impact edges and markers | `/memories/{id}/impact`, MNEME `causality.impact()` |
| `containment-system.ts` | Stages preview and submits the one commit | Preview endpoint, then authenticated quarantine endpoint |
| `counterfactual-system.ts` | Renders exclusion/containment deltas in a ghost chamber | Counterfactual endpoints |
| `portable-system.ts` | Requests bundle export/verification and downloads JSON | `/bundle/export` |
| `tour-script.ts` / `onboarding-stage-machine.ts` | Defines the guided questions and reveal states | Explicit `OnboardingEvents` only |
| `login-overlay.ts` / `session.ts` | Handles demo authentication in memory | Adapter session endpoint; no persistent browser session |

The interaction grammar is deliberately conservative. A short pinch selects;
a held pinch carries a grabbable; a drop stages a preview. A UI click is a
separate event. A physical drop cannot directly mutate authoritative state.
The client also supports desktop pointer input for development and access;
that is not a claim of physical hand tracking.

Presentation invariants are covered in
`client/tests/observatory-invariants.test.mjs`: custody colors are the only
evidence-bearing palette; transport, supersession, and counterfactual states
do not reuse custody colors; causal classes differ by more than color; the
counterfactual chamber does not overlap the factual field; wired controls exist;
and buttons meet the authored minimum height.

## Server behavior and protocol

### Nivel 1 — field inspection

The adapter returns the seeded field, memory records, custody chains, and
authority data. Reads use query-only connections. A per-boot `field_epoch` and
a persisted `field_version` let the client distinguish a reset world from an
empty response and detect stale mutation proposals.

### Nivel 2 — audited containment

`GET /api/v1/actors/{id}/quarantine-preview` runs the same MNEME query used by
the eventual `trust.quarantine_actor` operation. The preview is read-only.

`POST /api/v1/actors/{id}/quarantine` requires a demo session, an
`expected_field_version`, and an idempotency key. The adapter calls MNEME's
authorized operation rather than writing raw SQL. MNEME's own `authority.gate`
rejects an actor without `QUARANTINE_ACTOR`. The server returns `409` for a
stale snapshot and distinguishes that response from an already-quarantined
target.

The session store is bounded, TTL-swept, in memory. The demo password is
shared and configured through the environment. There is no external identity
binding or refresh UX in this slice.

### Nivel 3 — causal field

`GET /api/v1/memories/{id}/impact` wraps MNEME's `causality.impact()` and
returns direct receipts, direct decisions, derived memories, derived
unattested memories, derived decisions, possible memories, and an
`impact_sha256`. The demo seed includes a receipt, a decision citing
`mem-poison`, and a derived note so the causal surface has real fixture data.

Receipt and decision detail endpoints, and claims/standing, are not included
in this slice. Some causal markers are therefore visual representations of the
impact response rather than independently selectable detail objects.

### Nivel 4 — counterfactual chambers

`GET /api/v1/counterfactual/exclusion-effect` performs a narrowing-only,
read-only comparison available to the read token. It shows what becomes
unavailable when a memory is excluded.

`GET /api/v1/counterfactual/containment-effect` performs a widening comparison
that can disclose custody-withheld material, so it requires a session with the
appropriate MNEME capability. MNEME's authority gate makes that decision; the
adapter supplies the actor context. These reads append an adapter-local audit
record to `data/read_audit.jsonl`. That record is not sealed MNEME evidence.

The two demo queries are fixed literals matching the persisted Nivel 3
receipt. Arbitrary query and target input is intentionally not exposed. The
client renders a delta and a ghost cluster, not two complete independently
mutable fields.

### Nivel 5 — portable epistemic instrument, first slice

`GET /api/v1/bundle/export` exports the field, then invokes the independent
MNEME verifier through `subprocess`. The producing process does not call the
verifier as an in-process helper. The response includes the bundle, its
declared hash, verifier stdout, and verifier exit code.

The field version is derived from persisted custody-chain event count. It
grows with mutations and is used as a stale-snapshot precondition. Existing
transaction handling already commits or rolls back the one mutation; no new
distributed transaction protocol is claimed here.

## Trust model and threat boundaries

### Trusted for this prototype

- MNEME's authorized API and its authority checks;
- MNEME's custody, recall, impact, counterfactual, export, and offline
  verification implementations;
- the adapter's narrow endpoint mapping and transaction boundary;
- the fixture and the test commands when run in their documented environment.

### Not trusted as authority

- XR positions, gestures, pointer coordinates, colors, proximity, size, or
  visual emphasis;
- the browser's read token as a secret;
- client-side UI state as proof of a committed mutation;
- a narrator, screenshot, or README sentence as evidence of a backend result.

The client is a projection. It proposes intent and displays responses; it does
not decide custody, authority, causality, or counterfactual permission.

### Known threat and deployment gaps

- The public read token is extractable from the static bundle.
- Demo sessions are in memory and use a shared configured password.
- The deployed adapter has no persistent volume; a cold start can reseed the
  demo field and invalidate assumptions based on an earlier epoch.
- The field-version check detects stale clients but does not claim to solve
  simultaneous multi-operator races.
- Bundle import and re-verification of a bundle produced elsewhere are not
  implemented.
- The adapter's read audit for widening counterfactuals is local metadata, not
  part of the sealed bundle.
- No physical headset, Meta XR Simulator, or real-user comfort study is
  evidence in the repository's current reports.

## Determinism and evidence boundaries

The demo's strongest integrity boundary is MNEME's own bundle hash and
independent offline verifier. ENGRAM displays those results and preserves the
separation between factual state and counterfactual projection. ENGRAM does
not independently reimplement MNEME's cryptographic protocol, and this
repository does not claim that a screenshot is tamper-evident evidence.

The synthetic fixture is reproducible through `scripts/verify-fixture.py`,
but the live hosted service is not a persistent deterministic environment: its
field can reseed after a cold start. Any claim about a particular live state
must therefore include the observed `field_epoch`/field version and time.

## Reproducibility

From the repository root:

```sh
./scripts/dev-local.sh
python3 scripts/verify-fixture.py
python3 scripts/test-adapter.py
```

For the client:

```sh
cd client
npm install
npm run typecheck
npm test
npm run build
```

The adapter requires the sibling MNEME checkout or the configured dependency,
an `ENGRAM_READ_TOKEN`, an exact `ENGRAM_CLIENT_ORIGIN`, and a configured demo
password. See `server/README.md` and `client/README.md` for environment and
deployment details. The production client is built with the adapter URL and
read token in its static environment, so those values must be treated as
public deployment configuration.

## Repository map

```text
client/       WebXR/IWSDK client, Canvas surface, UI systems, and tests
server/       FastAPI adapter, seed fixture, deployment configuration
scripts/      Local orchestration, fixture verification, adapter tests,
              and readiness checks
docs/         Demo scenario, security rounds, XR audits, and release evidence
visual/       README gallery plus exported bundle and Canvas artifacts
README.md     Human-facing English entry point
README.es.md  Human-facing Spanish adaptation
README_TECHNICAL.md  This detailed engineering account
```

## Remaining work

### Next for the competition demo

- capture and review physical Meta Quest hand-interaction evidence;
- rerun the release-candidate checks against the exact submission commit;
- keep the demo path to one investigation, one intervention, and one
  verification rather than presenting every endpoint;
- expose the evidence bundle and Canvas export in the submission artifact.

### Next for a real research tool

- persistent storage and a deployment model that does not reseed the field;
- external identity, per-actor sessions, refresh/revocation, and audit policy;
- concurrent-operator conflict handling beyond stale-version rejection;
- bundle import and independent re-verification of external bundles;
- arbitrary but safely bounded research queries and target selection;
- receipt, decision, claim, and standing detail surfaces;
- real-user research with AI-memory investigators to test whether spatial
  interaction reveals something difficult to notice in 2D;
- physical comfort, accessibility, tracking, and legibility validation on
  supported Meta hardware.

## Development provenance

Selected implementation and design decisions were developed with assistance
from OpenAI Codex, Kimi, Anthropic Claude, and Meta's Muse model. The author
directed the work, integrated the changes, and verified the repository state.
This is a tool-use disclosure, not a claim that the models were users,
reviewers, or independent validators of the product.

## License

Apache License 2.0. Copyright 2026 Anna Tchijova.
