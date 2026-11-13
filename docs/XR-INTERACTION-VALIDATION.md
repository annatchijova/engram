# XR Interaction Validation

Project path: WebXR via IWSDK (`@iwsdk/core` 1.0.1, verified against
Meta developer docs this session). Config: VR mode, hand tracking,
seated (locomotion false), grabbing true, Quest 3 emulator declared.

## What was checked

- `metavr device list` returned no devices: no Quest is connected, so
  no hand-tracking, pinch, comfort or frame-rate claim is made.
- `metavr xrsim runtime ping` failed with "XR Simulator is not
  running" — the frontend-tier hop: no simulator frontend is listening
  on this machine. Starting it is a user-machine action, not performed.
- Code-level facts only: seated arc (140 degrees, R 0.9 m), camera
  re-centred on the arc in `iwsdk.config.json`, `Pressed` unifying
  hand-ray/pinch and desktop mouse. Desktop mouse is emulated input,
  not hand-tracking evidence.
- The XR scene/systems carry the uncommitted login/onboarding
  migration; composition changes beyond the camera wait for it to land.

## Round 5 note

The desktop board is now a spatial provenance graph fed by MNEME's
typed DAG (`edges` on the impact response). XR has no focus/subgraph
mode today (selection is a single `Pressed` id; trace scans all
nodes), and no new XR system can be registered without editing the
uncommitted login/onboarding WIP files. The 2D fallback therefore
carries the full investigation; XR parity waits for that migration.

## What requires real hardware or a running simulator

Hand-tracking reliability, text readability at viewing distance,
selection comfort, tracking-loss recovery, and end-to-end hands-only
completion of the investigation. Each needs a Quest session or the
XR Simulator frontend plus the app attached (`xrsim runtime list`
first, then `runtime status --strict`).

## Investigation Room round (implemented, unverified on device)

Graphite-blue scene background with restrained fog; QUARANTINED slabs
carry a red wireframe containment frame in addition to color; the
selected slab scales 1.3x as non-color feedback; guided texts now run
as Acts I-IV (Discovery, Provenance, Impact, Counterfactual). All of
it typechecks and builds; none of it has been seen in a headset or
the simulator, so readability and comfort remain open.

## Guided-tour gating fix (preview unlocks comparison; commit does not gate investigation)

Defect found in `client/src/onboarding-system.ts`: the Counterfactual
Chamber was revealed only at `CONTAINMENT_DONE`, which required
'commit-done' — a real actor-quarantine mutation. The staged preview
event ('stage-done', emitted by `containment-system.ts` after a
successful preview) advanced nothing. The guided tour therefore pushed
the operator to commit a real quarantine in order to reach the
counterfactual comparison. "Show everything" existed as an escape
hatch and MNEME authorization was never bypassed, so this was a design
defect, not an authorization vulnerability.

Fix: the stage machine now lives in the pure, testable module
`client/src/onboarding-stage-machine.ts`. 'stage-done' advances the
tour to the new `PREVIEW_DONE` stage, and the chamber is revealed from
`PREVIEW_DONE` on. The 'Contained it' checklist milestone still
requires 'commit-done', so a preview never claims containment
happened, and stages remain monotonic (a late commit never drags the
tour backwards). Regression coverage:
`client/tests/onboarding-gating.test.mjs` (5 tests; the tour reaches
the chamber with no commit, the preview does not claim containment,
the chamber stays hidden before the preview, monotonicity holds, and
the full loop still completes). Client suite: 28/28, typecheck clean,
production build ok.

## Round 8 validation (desktop browser only)

Executed 2026-11-04 in headless Chromium (SwiftShader) against the
production build plus the live seeded adapter (9 memories, field
version 22): the XR scene boots with zero console errors, all 9
custody slabs render on the arc facing the viewer under the new light
rig, and the Acts/legend/login panels are legible at 1366x768. With
the adapter down, the scene reports the unreachable adapter honestly
and fabricates nothing. A desktop mouse click on a slab produced no
visible selection change in this run, so desktop-pointer selection
feedback is NOT VERIFIED. The in-world Acts buttons are UIKit panels,
not DOM controls, and were not driven. Headset, controllers, and hand
tracking remain NOT TESTED; full detail in
[XR-IMPLEMENTATION-ROUND8.md](XR-IMPLEMENTATION-ROUND8.md).

## Round 9 validation (emulated Quest 3, full loop)

The XR client is now **ENGRAM — The Memory Observatory**: a seated room
with five functional zones (factual field, provenance structure,
intervention station, counterfactual chamber, verification instrument)
plus an actor registry. Full report, evidence tables and limitations:
[XR-OBSERVATORY-ROUND9.md](XR-OBSERVATORY-ROUND9.md).

Executed in the IWSDK managed browser with the IWER **Meta Quest 3**
emulator against the live adapter, driving real controller rays and
asserting on ECS component values and live UIKit element state:

- **28 checks pass**: the whole investigation loop (observe, select,
  inspect, trace, stage, compare, commit, verify, collapse), both
  authority refusals (403 for an actor without the grant, on both the
  widening counterfactual and the commit), the stale-snapshot refusal
  (409, field untouched), and three adapter-down degradation paths
  including a cold start that renders zero memories and says why.
- **Desktop-pointer selection, open since Round 8, now passes**: a mouse
  click selects a core and opens the inspector, and a mouse click drives
  an in-world UIKit button (the login submit reaching a real 401).
- **Still NOT TESTED**: any physical headset, the Meta XR Simulator, real
  hand tracking, and the in-headset keyboard. No Quest was connected
  (`metavr device list` → `[]`) and `xrsim runtime ping` reports the
  simulator is not running on this machine.

Five real defects were found by driving the runtime (label sprites and
line outlines hijacking every ray hit; `OneHandGrabbable` denying ray
selection outright; UIKit's 300 ms click threshold plus nested-container
layout making buttons unpressable; a successful commit erasing its own
confirmation) and are documented with their fixes in the round report.
