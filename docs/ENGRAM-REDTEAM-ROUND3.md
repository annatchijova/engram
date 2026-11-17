# ENGRAM Round 3 — Red-Team Report

Threat model: attacker controls every byte a client sends (headers,
bodies, layout storage, memory content text) and can replay requests;
attacker cannot forge MNEME seals, server env secrets, or another
actor's grants. Probes map to the 17 rows of
ENGRAM-ARCHITECTURAL-INVESTIGATION.md section 7. "Observed" only ever
means executed in this repo/session; everything else is labelled
PLAUSIBLE HYPOTHESIS or UNRESOLVED, never "safe".

| # | Probe | Prediction | Observed | Verdict |
|---|---|---|---|---|
| 1 | Falsified provenance (invented custody history) | Hash chain + bundle verifier reject; UI displays, never re-verifies | Bundle export verified by independent verifier in Round 2 induction; Canvas states it displays the chain without re-verifying | CONFIRMED (verifier path), UI limit declared |
| 2 | False timestamp | served_at is wall-clock; field_version is the ordering value | Envelope code + Canvas snapshot line shows field_version, not served_at | CODE FACT |
| 3 | Stale snapshot commit | 409, field unchanged | Live probe: commit at expected_field_version=1 -> 409, health field_version stayed 21 | CONFIRMED BY INDUCTION |
| 4 | Gesture ambiguity (drag = commit) | Drag changes layout only | Test 1 + negative control (Round 2) | CONFIRMED (unit) |
| 5 | Replay / duplicate commit | Idempotency key + already-QUARANTINED dedup | Code path read; duplicate-commit live probe NOT executed (would mutate demo field) | PLAUSIBLE HYPOTHESIS |
| 6 | Spatial misrepresentation (POSSIBLE as causal) | Label/dash/legend say NOT causal at any distance | Tests 3 + 10 | CONFIRMED (unit) |
| 7 | Causal omission (graph looks closed) | Inspector lists every class incl. none-values; impact seal shown | Canvas renders all lists with explicit "none" | CODE FACT |
| 8 | Visual authority inflation | Size/brightness never encode authority; capabilities listed from MNEME only | Card size fixed; login panel lists server-issued capabilities | CODE FACT |
| 9 | Counterfactual leakage into factual | Hypothetical isolated; error discards it | Tests 2 + 7, mutation caught in Round 2 | CONFIRMED (unit) |
| 10 | Concurrent mutation race | Transaction + version check conflict explicitly | Stale case confirmed (#3); simultaneous race not probed | UNRESOLVED (named deferral) |
| 11 | Verification failure | Tri-state, never silent PASS | Bundle verifier statuses rendered verbatim incl. UNAVAILABLE branch | CODE FACT |
| 12 | Partial physical interaction | Pending intent is not MNEME state | Canvas staged preview is labelled staged-only; XR pending-intent path is WIP, not probed on device | PLAUSIBLE HYPOTHESIS |
| 13 | Forged embedding | Boundary declared, not solved | No embedding UI; limit named in architecture docs | UNRESOLVED by design |
| 14 | Causal overclaim (DERIVED as DIRECT) | Classes from list membership, never distance | Tests 3 + 10 | CONFIRMED (unit) |
| 15 | Quarantine without reversal warning | UI warns before commit | Inspector text states no reversal through this adapter, before the commit button | CODE FACT |
| 16 | Read-audit gap (widening) | Widening audited RECORDED/WRITE_FAILED | Live: omar containment-effect 200 with read_audit RECORDED; ada 403 | CONFIRMED BY INDUCTION |
| 17 | Missing resonant writer ("connect" gesture) | No connect gesture exists without an MNEME operation | Canvas offers no edge-creation gesture at all | CONFIRMED (absence by construction) |

Additional Round 3 probes (connection layer): wrong-origin preflight
predicted refused — observed 400; login preflight with Content-Type
predicted blocked before fix — observed 200 after fix; unauthenticated
read predicted 401 — observed 401. Prompt injection inside memory
content: Canvas escapes all interpolated fields (`esc()`), and content
is rendered as text, never HTML — CODE FACT, no live payload probe.
Malformed payloads and very large graphs: UNRESOLVED — no fuzz or
scale probe was run; the board renders at most the adapter's 200-memory
page. Accessibility failures: keyboard paths exist by construction
(native buttons, arrows, focus outline, reduced-motion CSS); no
screen-reader or browser test was executed — UNRESOLVED, not compliance.

Falsified hypotheses worth keeping: "the fixture is bit-reproducible"
— falsified: decision ids are random per seed and hashes embed
wall-clock time; the fixture is structurally reproducible only
(scripts/verify-fixture.py). "Fixing .env alone fixes the connection"
— falsified: Vite bakes VITE_* at start and CORS rejected POSTs even
with the right port.

## Claim audit and bounds

Every CONFIRMED above sits next to its executed run (live adapter
probes on the seeded field, commit ffcae4c/5842672, or the named unit
test); CODE FACT means code was read, not run; PLAUSIBLE and
UNRESOLVED are stated at the claim, not buried. Scope: local adapter +
seeded demo field + desktop Canvas logic. Not examined: Quest device
behaviour (device list empty), browser rendering, simultaneous-race
commits, malformed-payload fuzzing, large-graph scale. Falsifiers:
probe 3 reopens if a stale commit ever returns 200; probe 9 reopens
if a test or trace shows served_b rendered on the factual board;
probe 16 reopens if a widening response lacks the audit marker.
