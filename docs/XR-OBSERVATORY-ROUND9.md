# XR Round 9 — ENGRAM, The Memory Observatory

Baseline: `175a329` on `main`. Work branch: `feat/engram-memory-observatory`.
Every claim below carries an explicit evidence label. Nothing is promoted
beyond what was actually executed. The Canvas 2D surface, the adapter and
MNEME's rules are unchanged.

## What this round is

The XR client was a single arc of flat slabs with panels floating around
it. This round rebuilds it as a seated **observatory**: an architectural
room with five functional zones, objects that can be picked up and placed,
provenance and causality given physical form, and a sealed hypothetical
volume that is visibly a different place from the recorded field.

Everything rendered comes from the existing adapter
(`server/app.py` → MNEME). No value is computed, smoothed or invented in
the client, and the one mutating endpoint is still reached only through an
explicit, authorized Commit.

## The five zones

| Zone | Physical form | What it shows | Source |
|---|---|---|---|
| **Factual field** | a lit bench arc of nine *memory cores* (crystal in a glass capsule on a metal base) | every memory in the field, custody colour on the crystal and its halo, QUARANTINED cores inside a red containment cage | `GET /api/v1/memories`, `/field/overview` |
| **Provenance structure** | a hash-linked block tower above the selected core, plus a grey SUPERSEDED_BY lineage link | the real custody chain in `seq` order with actor and `entry_hash`; the successor MNEME recorded | `/memories/{id}`, `/memories/{id}/custody` |
| **Causal field** | volumetric edges from the traced core: solid bar (DIRECT), dashes (DERIVED), thin dashes (DERIVED_UNATTESTED), hairline (POSSIBLE), each carrying its own text label | MNEME's own `causality.impact()` result | `/memories/{id}/impact` |
| **Intervention station** | a console plus a physical **cradle**: drop an actor totem in it to stage | the exact memories a sweep *would* flag, as an amber PREVIEW ring on each one | `/actors/{id}/quarantine-preview` |
| **Counterfactual chamber** | a separate violet containment column holding two rails (WORLD A / WORLD B) and violet ghost cores | exactly what each world served, what moved, and the sealed delta hash | `/counterfactual/exclusion-effect`, `/containment-effect` |
| **Verification instrument** | a green column with the sealed bundle artifact floating inside | the independent verifier subprocess's own verdict and exit code | `/bundle/export` |
| **Actor registry** | totems on a back shelf (capsule = HUMAN, icosahedron = AGENT, cylinder = PIPELINE) | actor status, and on selection the full authority chain with the issuer of every grant | `/actors`, `/actors/{id}/authority` |

## Semantic rules the build keeps

- **Size never means authority.** Every memory core is identical in size
  and shape. Only the crystal/halo colour varies, and only from
  `CUSTODY_COLOR`.
- **Brightness never means confidence.** Hover swell, selection lift, the
  selection beam and the slow bob are identical for every custody status.
- **Proximity never means causality.** Bench order is the server's list
  order; causal relations exist only as labelled edges from a real
  `impact()` response.
- **POSSIBLE can never read as DIRECT.** They differ on four channels at
  once: colour, form (hairline vs solid bar), radius, and whether a pulse
  travels along the edge. Pinned by test `O4`.
- **A transport failure is not a custody state.** LOADING and READ FAILED
  marks use a neutral instrument grey that appears in no custody map and
  say so in words. Pinned by test `O2`.
- **The hypothetical is a different place.** The chamber is a separate
  volume whose rim never touches the field's outer edge. Pinned by `O5`.
- **Dropping something never commits.** Placing a totem in the cradle only
  calls the read-only preview endpoint; Commit stays a separate, explicit,
  authorized click. (`ENGRAM-ARCHITECTURAL-INVESTIGATION.md` §4 lists
  "soltar para ejecutar una mutación" among the gestures that must not exist.)
- **A superseded memory is retired, not deleted**, and is drawn connected
  to the successor MNEME names in `superseded_by`.

## Verification actually executed

Environment: Linux, Chromium managed by the IWSDK dev runtime, IWER
emulated **Meta Quest 3**, live adapter on `:17347` against the seeded
synthetic field (9 memories, field_version 22). Driven through
`@iwsdk/cli` (`xr`, `ecs`, `ui`, `browser`), asserting on ECS component
values and live UIKit element state, not on screenshots.

### Investigation loop — emulated XR, 15/15

| # | Check | Result | Evidence |
|---|---|---|---|
| 00 | XR session enters, hand-tracking feature negotiated | **PASS** | `sessionMode=immersive-vr`, `runtimeKind=emulated`, features `local-floor, bounded-floor, hand-tracking, viewer, local` |
| 01 | Field renders from MNEME | **PASS** | 9 `MemoryNode` entities, ids match the fixture |
| 02 | Select a core with controller ray + pinch | **PASS** | inspector title `mem-poison - TAINT_FLAGGED` |
| 03 | Inspect content hash + custody chain | **PASS** | `custody chain (4 events)`, `sha256 c709169dba90f760…` |
| 04 | Trace impact | **PASS** | `DIRECT: 1 receipt(s), 1 decision(s)`, `DERIVED: mem-note`, `DERIVED (unattested): mem-omar-note`, 4 POSSIBLE |
| 05a | Actor registry renders | **PASS** | 5 totems: agent-ada, analyst-omar, pipeline-feeds, pipeline-logs, root-ops |
| 05b | Actor authority chain with grant issuer | **PASS** | `#1 GRANTED - issued by root-ops … capabilities: REINFORCE, STORE`; pipeline-feeds effective capabilities: none |
| 06 | Stage by physically placing a totem in the cradle | **PASS** | totem `Grabbed`, released at `[1.10, 0.92, -0.30]`, preview: would TAINT_FLAG `mem-log-ingest` |
| 07 | Log in as `agent-ada` (STORE/REINFORCE/DECIDE) | **PASS** | `logged in as Agent Ada` |
| 08 | MNEME refuses ada's widening counterfactual | **PASS** | `HTTP 403: Actor 'agent-ada' holds no active grant conferring COUNTERFACTUAL` |
| 09 | Exclusion forecast needs no capability | **PASS** | `INTERFERENCE: removed=1, reranked=4, claims flipped=1`, receipts A/B + delta hash |
| 10 | MNEME refuses ada's commit | **PASS** | `HTTP 403: … conferring QUARANTINE_ACTOR`; field unchanged |
| 11 | Log in as `analyst-omar` | **PASS** | `logged in as Analyst Omar` |
| 12 | Authorized commit mutates MNEME; field and rack re-read | **PASS** | `committed: sweep sweep-…`; `mem-log-ingest CLEAN → TAINT_FLAGGED`; rack `pipeline-logs = QUARANTINED` |
| 13 | Bundle export + independent verifier | **PASS** | `verifier (independent subprocess): VERIFIED exit 0 … every check (B0-B9) passed` |
| 14 | Collapse chamber, factual field untouched | **PASS** | `cf-result` cleared, 9 cores still present |

### Refusal and degradation — emulated XR, 7/7

| # | Check | Result | Evidence |
|---|---|---|---|
| R1 | Preview staged against a known `field_version` | **PASS** | staged at field_version 22 |
| R2 | Operator session obtained in-world | **PASS** | `logged in as Analyst Omar` |
| R3 | Field moved out of band by another operator | **PASS** | agent-ada quarantined via a separate client, field_version 22 → 25 |
| R4 | Stale commit refused, nothing flagged | **PASS** | `HTTP 409: stale snapshot: field is now at ve…`; `mem-log-ingest` still CLEAN |
| R5 | Adapter down: export fails honestly | **PASS** | `FAILED to export: … unreachable or timed out`; no VERIFIED anywhere |
| R6 | Adapter down: staging fails honestly | **PASS** | `FAILED to preview: … unreachable or timed out` |
| R7 | Cold start with no adapter | **PASS** | legend shows `FAILED to load field: …`, **0** cores rendered (nothing invented) |

### Hover, lineage, authority — emulated XR, 6/6

| # | Check | Result | Evidence |
|---|---|---|---|
| H1 | Hover shows the at-a-glance card | **PASS** | `preview-id = mem-forged-report` while hovered |
| H2 | Supersession lineage from `superseded_by` | **PASS** | `… / superseded_by mem-policy-v2` on `mem-draft-policy` |
| H3 | Operator's own grants inspectable | **PASS** | `COUNTERFACTUAL, QUARANTINE_ACTOR, QUARANTINE_MEMORY, REHABILITATE, REINFORCE, STORE, SUPERSEDE` |
| H4 | Cradle staging from a physical placement | **PASS** | preview staged for `pipeline-logs` |
| H5 | Authorized widening counterfactual | **PASS** | `INTERFERENCE: removed=1, entered=1, reranked=3` + decision-dependency note |
| H6 | Verifier verdict on the vault artifact | **PASS** | `VERIFIED exit 0` |

### Suites and build

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS**, clean |
| `npm test` (client) | **PASS**, 36/36 (8 new observatory invariants) |
| `npm run build` | **PASS**, `dist/` built |
| `python3 scripts/test-adapter.py` | **PASS**, 8/8 incl. 401 / 404 / stale-409 / 403 / audited-200 / bundle VERIFIED / tampered bundle rejected |
| `python3 scripts/verify-fixture.py` | **PASS**, fixture reproducible |
| `python3 scripts/readiness.py` | **PASS**, 5/5 |

### Desktop pointer

| Check | Result |
|---|---|
| Mouse click selects a core (the Round 8 gap) | **PASS** — `mem-gate`, later `mem-poison`, opened the inspector |
| Mouse click drives an in-world UIKit button | **PASS** — login submit reached the server (`Invalid username or password.` from a real 401) |

### Performance

Desktop managed browser, NVIDIA RTX 3090, devicePixelRatio 1, IWER
emulation, 1136 frame samples over 14.6 s:

| Metric | Value |
|---|---|
| frame interval p50 | 10.0 ms |
| frame interval p95 | 10.1 ms |
| frame interval max | 20 ms |
| dropped frames | 0 |

**This is a desktop diagnostic, not a headset measurement.** The tool
itself labels it `calibrated: false, classification: host-browser-diagnostic`.
No claim is made about Quest frame time, reprojection or thermals.

### NOT TESTED

- **Any physical headset.** `metavr device list` returned `[]` for this
  session: no Quest was connected, so hand tracking, pinch reliability,
  comfort, text legibility at real IPD, tracking-loss recovery and
  on-device frame time are all unverified.
- **Meta XR Simulator.** `xrsim runtime ping` reports the simulator is not
  running on this machine; validation used the IWER emulator inside the
  managed browser instead.
- **Real hand input.** Every interaction above was driven through the
  emulated controller ray. `handTracking: true` is declared in
  `iwsdk.config.json` and the pinch path is the same `Pressed`/select
  pipeline, but that is an inference, not an observation.
- **In-headset keyboard.** The operator login was typed by filling the
  UIKit input's DOM backing element. On a Quest this is the Quest Browser
  virtual keyboard, which was not exercised.

## Defects found and fixed during this round

All five were found by driving the real runtime, not by reading code.

1. **Every pointer hover resolved to the same core.** Canvas-texture label
   sprites were being hit-tested; `three`'s `Sprite.raycast` needs
   `raycaster.camera` and throws without it, aborting the whole
   intersection pass with partial results. Labels are now explicitly
   non-raycastable (`src/observatory/labels.ts`).
2. **Hover still resolved to the nearest core only.** `Line.raycast` uses a
   1 m default threshold, so each core's decorative base outline swallowed
   rays aimed at its neighbours. The outline is now non-raycastable
   (`src/observatory/memory-core.ts`).
3. **Cores were unreachable by the XR ray.** `GrabSystem` sets
   `pointerEventsType = { deny: 'ray' }` on `OneHandGrabbable` objects, so
   the hands-first grab silently disabled ray selection. Cores and totems
   now use `DistanceGrabbable` (`MoveFromTarget`): a short pinch selects,
   a held pinch carries the object along the same ray.
4. **In-world buttons did nothing on a long press.** `@pmndrs/pointer-events`
   only emits `click` when press and release fall inside
   `clickThresholdMs` (300 ms). Documented in `src/trace-system.ts`; the
   panels were also re-laid out so every control is a direct child of the
   panel root, because a nested row offsets its children in UIKit's own
   layout report and made the commit/cancel buttons unaimable.
5. **A successful commit erased its own confirmation.** `FieldSystem.refresh()`
   rebuilds the actor rack, which lifts the totem out of the cradle, which
   fired the undock path and cleared the result line a frame after the
   sweep. Undock now preserves a finished outcome
   (`src/containment-system.ts`).

Two ergonomic defects were caught by the new tests rather than by eye: the
login submit button (2.3 cm) and the tour's skip button (1.7 cm) were below
the 2.4 cm ray-target floor now pinned by test `O7`.

## Files changed

| File | Change |
|---|---|
| `client/src/observatory/palette.ts` | new — zone accents and the seated room layout (field, chamber, vault, cradle, rack) |
| `client/src/observatory/labels.ts` | new — canvas-rendered text sprites; all in-world typography is generated in code |
| `client/src/observatory/memory-core.ts` | new — the memory core object (crystal, capsule, base, containment cage) |
| `client/src/observatory/observatory-environment.ts` | new — the room: floor rings, walls, ceiling strips, bench, consoles, containment column, vault column, light rig, dust |
| `client/src/observatory/observatory-handles.ts` | new — handles the systems use to light their own zone |
| `client/src/observatory/audio-cues.ts` | new — WebAudio-only, discreet, switchable confirmation cues |
| `client/src/observatory/wiring.ts` | new — loud boot-time report for any in-world control id that does not resolve |
| `client/src/field-system.ts` | memory cores, hover/selected/loading/failed states, selection beam and ring, custody colour transitions preserved |
| `client/src/selection-system.ts` | publishes the fetched record, shows LOADING/READ FAILED on the core, audio cue |
| `client/src/custody-chain-system.ts` | new — custody tower and SUPERSEDED_BY lineage link |
| `client/src/trace-system.ts` | volumetric edges, per-edge text labels, travelling pulses, labelled receipt/decision markers |
| `client/src/actor-system.ts` | new — actor registry totems, grabbable, with the real authority chain inspector |
| `client/src/actor-totem-component.ts` | new — ECS component for a totem |
| `client/src/containment-system.ts` | intervention cradle, staged PREVIEW rings on the field, outcome persistence |
| `client/src/counterfactual-system.ts` | containment column contents: WORLD A/B rails, ghost cores, sealed delta summary |
| `client/src/portable-system.ts` | sealed bundle artifact in the vault, coloured by the verifier's own verdict |
| `client/src/ambience-system.ts` | per-frame dust and zone glow |
| `client/src/intervention-store.ts`, `client/src/field-events.ts`, `client/src/selected-memory.ts` | small stores so systems share server payloads instead of re-fetching |
| `client/src/engram-api.ts` | added `getAuthority()` (existing adapter endpoint, previously unused) |
| `client/public/ui/*.uikitml` | all panels restyled; every control is a root-level, ≥2.4 cm target; new `authority.uikitml` |
| `client/public/scenes/main.iwsdk.scene.json` | panels repositioned as consoles around the seated pose, clear of their own zones |
| `client/iwsdk.config.json` | desktop hero camera reframed for the observatory |
| `client/tests/observatory-invariants.test.mjs` | new — 8 invariants (palette, edge classes, zone separation, wiring, ergonomics, audio) |

## Limitations, stated

- No headset, no simulator, no hand tracking in this round (see NOT TESTED).
- The read token is still baked into the client bundle; unchanged from
  earlier rounds and still only unlocks read endpoints.
- The intervention cradle stages any actor the rack shows. MNEME decides
  what a commit may do; a juror can drop `root-ops` in and watch the 403.
- The counterfactual chamber shows the delta MNEME returned for the two
  fixed demo queries. Arbitrary query authoring is not in this round.
- Audio is generated in code and deliberately quiet. It confirms, it never
  informs: every cue follows information already on screen.
- The demo field is the documented synthetic fixture. The commit test in
  this report mutates it; `server/seed_demo_field.py --reset` restores it,
  and it was reset after the final run.

## External assets that would help (none are required)

The scene is entirely procedural — geometry, materials, lighting and every
glyph are generated in code, so nothing below blocks the experience.

1. **Room shell model** (glTF, ~15 k tris, PBR, 9 × 9 × 3.6 m interior):
   a real laboratory shell with panelling, cable runs and skirting to
   replace the parametric walls in `observatory-environment.ts`.
2. **Memory core mesh** (glTF, ≤2 k tris, 0.2 m tall): a designed capsule
   with bevelled glass and a machined base, replacing the composed
   primitives in `memory-core.ts`. Must keep one material slot whose
   colour the custody map drives.
3. **Actor totem set** (3 glTF meshes, ≤1 k tris each): distinct silhouettes
   for HUMAN / AGENT / PIPELINE, replacing capsule / icosahedron / cylinder.
4. **A condensed technical typeface** (woff2 or MSDF atlas) for the canvas
   label renderer, in place of the system sans-serif.
