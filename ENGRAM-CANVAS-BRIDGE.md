# ENGRAM Canvas Bridge

Status: implemented on `feat/engram-canvas-bridge`. The XR/IWSDK surface is
untouched; the Canvas is a second projection over the same MNEME-backed
adapter (`client/src/engram-api.ts`). No new authoritative engine exists.

## Destination and levels (destination-driven, no MVP scoping)

Destination: one investigable memory with evidence parity between the
desktop Canvas and the XR surface — same envelope, same selected memory,
same custody/relation meanings, same sealed values, in both.

- **Level 1 (this branch): Canvas investigation surface.** Field overview,
  memory cards, provenance/custody inspection, typed impact tracing,
  actor-containment preview -> staged commit, query-scoped counterfactual
  comparison, evidence-bundle export, keyboard operation. Invariants
  I1-I10 (directive section 6) are inherited here, not deferred:
  projection is not authority; drag is presentation-only (localStorage
  `engram.canvas.layout.v1`); stage != commit (`canCommit` re-checks
  `field_version`, server still returns 409); authorization stays in
  MNEME (`require_session` + `authority.gate`); counterfactual data lives
  only in the dashed COUNTERFACTUAL panel; POSSIBLE is labelled NOT
  causal in text, dash and legend; unknown status renders as unknown.
- **Level 2: XR consumption of the shared selection.** Canvas already
  writes `?memory=<id>` + `sessionStorage` and links `index.html?memory=`.
  XR does not read that parameter yet — stated limitation, not fake sync.
- **Level 3: claims/receipts/decisions detail.** Requires new adapter
  contracts; MNEME has the internals, ENGRAM HTTP does not. Not invented.
- **Level 4: JSON Canvas round-trip hardening.** Export exists with an
  explicit loss list; no lossless claim is made.

Deterministic core: the Canvas computes no custody, authority, ranking or
confidence value. `confidence` is displayed as the server TEXT string;
hashes and MNEME's `summary` are shown verbatim beside their seals. The
only floats are card coordinates — presentation state outside every seal.
No LLM is called anywhere in this surface.

## Run (one command, from anywhere)

```sh
./scripts/dev-local.sh
# Adapter: http://localhost:8000 | Canvas: https://localhost:8081/canvas.html
```

The script starts the adapter, waits for `/health`, then starts Vite with
`VITE_ENGRAM_API_BASE=http://localhost:8000`. Round 3 root-caused the
original "Failed to fetch" to five stacked layers: wrong working
directory, a port split (8000 vs 8090 vs 8080), CORS origin scheme
(`http://` configured while Vite serves `https://localhost:8081`), CORS
preflight missing `Content-Type` (blocked every POST), and Vite baking
`VITE_*` at start. Adapter CORS now defaults to both localhost:8081
schemes and allows `Authorization, Content-Type`; verified live:
GET overview returns `access-control-allow-origin`, login preflight
returns 200, an unrelated origin is refused (400).

## Round 3 additions

- Connection states are explicit (Connected / Server unavailable /
  Authentication required / API schema mismatch / Empty investigation),
  each with its next action; `/health` is probed before the field loads.
- Three-region workspace: left investigation rail (snapshot, guided
  scenario, search, custody filter, evidence inventory, saved layout
  views, legend), center board with zoom/fit/reset, right inspector.
  Login moved into a collapsed contextual authorization disclosure.
- XR camera re-centred on the seated arc in `iwsdk.config.json` (clean
  file only; the uncommitted scene/login WIP was not touched). Meta docs
  verified via metavr: this project is the WebXR/IWSDK path; the device
  list was empty, so no headset behaviour is claimed.
- Tests: 14/14 (adds connection-state, viewport and Canvas/XR palette
  consistency). Predictions recorded before probes; stale commit (409),
  ada widening (403) and evil-origin preflight (400) behaved as predicted.
- Three-minute video script: 0:00 open Canvas, guided investigation
  highlights the compromised memory; 0:30 inspector provenance + custody;
  1:00 typed relationships and preview (no commit); 1:40 compare worlds
  with the sealed delta; 2:20 export bundle and read the verifier verdict;
  2:45 open the same memory in XR (`?memory=` link).
- Fixture: `python3 scripts/verify-fixture.py` seeds the Compromised
  Memory scenario twice into throwaway DBs through MNEME's public API
  and asserts structural identity (7/7 PASS). Bit-identical seals are
  explicitly not claimed: decision ids are random per seed and hashes
  embed wall-clock time.
- Red-team: ENGRAM-REDTEAM-ROUND3.md records predicted vs observed for
  the 17 probes, with unresolved items named (device behaviour, race,
  fuzz, scale) rather than smoothed over.
- XR beyond the camera tweak is bounded by preservation: scene and
  systems carry the uncommitted login/onboarding WIP, so composition
  changes there wait for that migration to land; the shared projection
  vocabulary now lives behind client/src/shared-projection.ts for XR
  to adopt, with palette parity pinned by test.

## 60-second walkthrough (first-time viewer)

1. Open the Canvas. Cards are memories; the badge (glyph + text + color)
   is the server custody status.
2. Click **Start guided investigation**: the first memory MNEME itself
   marks TAINT_FLAGGED/QUARANTINED is selected and inspected.
3. Read provenance, content hash and the expandable custody chain; the
   relationship list separates DIRECT / DERIVED / DERIVED (unattested) /
   POSSIBLE (not causal).
4. In Containment, preview the actor quarantine — exactly which memories
   would be flagged, at which `field_version`. Nothing has changed yet.
5. Compare worlds: FACTUAL vs COUNTERFACTUAL panels, removed/entered and
   rank changes, with `delta_sha256`. It is a query-scoped delta, and the
   hypothetical decision was never executed.
6. Export the evidence bundle; the verifier verdict is shown as
   VERIFIED / REJECTED / UNAVAILABLE. File integrity is not claim truth.

## Technical walkthrough (investigator)

- Selection writes the shared `SelectedMemory` store (same module XR
  uses) and mirrors it to `?memory=` for cross-surface hand-off.
- Impact edges come only from `ImpactReport` lists via `buildEdges`;
  receipts/decisions stay a DIRECT text list (no invented node targets).
- Commit path: login (`omar`/`ada`) -> preview stages `field_version` ->
  fresh overview re-check -> explicit confirm -> adapter 409/403 surface
  verbatim. Widening counterfactual without a session is refused in the
  UI and independently by MNEME (verified: ada -> 403).
- Bundle export reuses `GET /api/v1/bundle/export` and shows the
  independent verifier output; JSON Canvas export lists what it loses.

## Verification (executed, not assumed)

- `npm test` (client/): 11/11 pass, 0 skipped. Negative control: merging
  `served_b` into the factual set turned test 2 red; reverted to green.
- `npm run typecheck`: clean. `npm run build`: emits `dist/canvas.html`
  alongside `dist/index.html`.
- Runtime induction against the real adapter + seeded field: /health
  `field_version=21`; 8 memories (CLEAN 4, TAINT_FLAGGED 2, QUARANTINED
  1, SUPERSEDED 1); impact of `mem-poison` returns derived `mem-note`;
  exclusion delta 200; preview flags `mem-log-ingest`; omar widening
  200 `RECORDED`, ada 403; stale commit probe 409 with field unchanged;
  Vite serves canvas.html and index.html (HTTP 200).
- Not executed: any real quarantine commit (would mutate the demo
  field), browser automation/screenshots, Quest/headset interaction.

## Original interface vs Canvas workflow

| Aspect | XR surface (existing) | Canvas surface (new) |
|---|---|---|
| First comprehension | Spatial scene, headset-oriented | Familiar cards + labelled lines, desktop-first |
| Selection | Hand-ray Pressed on spheres | Native Inspect button, Enter/Space, search/filter |
| Relationships | 3D lines + markers | SVG lines + text labels + inspector list |
| Counterfactual | Ghost spheres in a chamber | Two labelled panels, delta tables + seal |
| Accessibility | No ARIA/keyboard found in audit | Labels, focus outline, arrow-key card move, reduced-motion CSS, aria-live status |

## Known limitations

- XR does not consume `?memory=` yet (Level 2); no token or pending
  intent crosses surfaces, deliberately.
- Counterfactual endpoints are seeded-query only; no arbitrary query UI
  because no HTTP contract binds those parameters.
- Claims, receipts/decisions detail, memory-level quarantine,
  rehabilitation, `as_of` snapshots, bundle import: no ENGRAM HTTP
  contract — absent from the UI rather than simulated.
- DOM rendering, drag and focus behaviour are covered by typecheck/build
  and HTTP serving only; no browser or device test was run.
- The pre-existing uncommitted login/onboarding migration on
  `devin-hardening` was left untouched; this branch adds files only.
- Adapter docstring still claims no mutation endpoint while
  `POST /actors/{id}/quarantine` exists — flagged for a doc fix, not
  silently relied on.

## Decision record

- Decision: DOM+SVG Canvas as a second Vite entry sharing `EngramApi`,
  `SelectedMemory` and custody hex meanings with XR.
- Forces: directive invariants I1-I10; no 2D fallback existed; dirty
  login WIP must not be disturbed; no new dependencies preferred.
- Alternatives rejected: new framework app (second stack to keep in
  parity); Canvas2D/WebGL board (weaker text/keyboard semantics);
  editing XR `index.ts` to read `?memory=` now (touches WIP migration).
- Assumption: seeded demo field remains the demonstration source.
- Reversibility: two-way — delete `canvas.html`, `src/canvas/`, tests;
  XR and adapter unchanged.
- Revisit trigger: an ENGRAM HTTP contract for claims/detail/`as_of`,
  or XR adopting the `?memory=` hand-off.
