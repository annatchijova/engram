# XR Implementation — Round 8: The Memory Crime Scene

Baseline: `b2bc006` on `feat/engram-canvas-bridge`. This report uses explicit
evidence labels. Nothing is promoted beyond what was executed.

## What changed in this round

| File | Change | Status |
|---|---|---|
| [client/src/canvas/canvas-state.ts](../client/src/canvas/canvas-state.ts) | `epistemicBanners()`: pure function returning epistemic-boundary banners from real inspector data | IMPLEMENTED |
| [client/src/canvas/canvas-main.ts](../client/src/canvas/canvas-main.ts) | Inspector renders the banners for the selected memory | IMPLEMENTED |
| [client/src/index.ts](../client/src/index.ts) | XR light rig (ambient + directional) over the graphite-blue scene and fog | IMPLEMENTED |
| [client/src/field-system.ts](../client/src/field-system.ts) | Evidence slabs enlarged (0.21 x 0.13 m) and oriented to face the seated viewer; quarantine frame resized to match | IMPLEMENTED |
| [client/tests/canvas-invariants.test.mjs](../client/tests/canvas-invariants.test.mjs) | Test R8 for the epistemic banners, including the real lowercase payload shape | IMPLEMENTED |

## Epistemic banners (Canvas inspector)

`epistemicBanners()` fires only on evidence the adapter actually returned:

- Selected memory is `CLEAN` and a custody-chain payload contains
  `derived_from_decision` (checked case-insensitively; the real payload key
  is lowercase) -> "CLEAN CUSTODY != VERIFIED CONTENT. This memory's custody
  is clean; its content derives from a recorded decision and is not thereby
  proven true."
- The `mem-poison` / `mem-gate` pair is both present and the selected memory
  has `TAINT_FLAGGED` custody -> "A custody problem is not proof of false
  content, and contradiction shown here is recorded content, not a
  `CONTRADICTED_BY` relation (MNEME has no such relation type)."

No banner is invented for any other state; unknown stays unknown.

## Verification actually executed

| Check | Result | Label |
|---|---|---|
| `npm test` (client) | 23/23 pass, including R8 | TESTED IN BROWSER (Node test runner) |
| `npm run typecheck` | clean | IMPLEMENTED |
| `npm run build` | ok | IMPLEMENTED |
| `scripts/readiness.py http://localhost:17347` | 5/5 PASS (adapter, MNEME field v22, auth, scenario 9 memories, snapshot) | TESTED IN BROWSER |
| `scripts/verify-fixture.py` | structural fixture checks pass | TESTED IN BROWSER |
| `scripts/test-adapter.py` | pass, incl. 401/404/stale-409/403/200-audited, bundle VERIFIED, tampered bundle rejected | TESTED IN BROWSER |
| XR page, headless Chromium (SwiftShader), adapter live | scene boots, 9 custody slabs render on the arc, NEXT/Acts panel, legend and login panels legible, zero console errors; screenshots `/tmp/r8-xr-1-overview.png` | TESTED IN BROWSER |
| XR page with adapter down | honest unreachable-adapter error, no fabricated data | TESTED IN BROWSER |
| Canvas, headless Chromium, adapter live | `mem-poison` present; banner "CLEAN CUSTODY != VERIFIED CONTENT" visible for `mem-note`; "proven false content" banner visible for `mem-poison`; screenshots `/tmp/r8-canvas-*.png` | TESTED IN BROWSER |
| Desktop mouse click on an XR slab | no visible selection change observed | NOT TESTED (selection feedback unverified via desktop pointer) |
| Guided Acts buttons (`Traced it` etc.) via DOM | they are in-world UIKit panels, not DOM controls; not driven by this run | NOT TESTED |
| IWSDK dev runtime inside this sandbox | `RuntimeOwnerError` (stale owner from 2026-11-03, pid dead; socket not connectable from the sandbox). Validation used the production build + static server instead | BLOCKED (environment) |
| Quest headset / hand tracking / pinch | no device connected (`metavr device list` empty in prior rounds) | NOT TESTED |
| FPS on standalone hardware | desktop headless render loop measured 59.4 fps under SwiftShader in an earlier probe; that is not headset performance | NOT TESTED |

A bug was caught by live data during this round: the derived-decision banner
originally matched an uppercase key and would never have fired against the
real payload (`derived_from_decision`). Fixed and covered by the R8 test
using the real payload shape.

## Scene composition notes

The XR scene remains one compact seated arc (140 degrees, radius 0.9 m,
slabs at 1.3 m height) with the Acts panel, custody legend, and operator
login composed around it. The five conceptual zones of the Memory Crime
Scene document are panel regions of this single room, not separate rooms;
no locomotion is required. Slabs now face the viewer so faces and the
quarantine wireframe read across the span.

## Invariants checked

- Presentation-only changes: slab size/orientation and lights touch no
  MNEME state; banners are derived read-only from adapter responses.
- No `CONTRADICTED_BY` relation was introduced; contradiction is shown as
  recorded content over the real relationship vocabulary.
- Counterfactual and containment flows were not modified in this round;
  their preview/stage/commit boundaries from earlier rounds stand.
- The live demo field was reseeded with the documented synthetic fixture
  (`server/seed_demo_field.py --reset`, 9 memories including
  `mem-omar-note`). That is the fixture mechanism, not production data.

## Known limitations

- XR remains visually sparse: one arc of slabs, no per-slab text labels at
  distance, large empty lower field. Declared, not hidden.
- Desktop-pointer selection feedback, in-world guided-button flow, and all
  headset behavior remain unverified.
- Canvas still has no Chromium screenshot pass at 1920/1440/1280/mobile
  widths in this round; layout claims rest on code and the 1366x768 run.
- XR does not consume `?memory=` from Canvas; no token or pending intent
  crosses surfaces, by design.

## Next honest steps

1. Drive the in-world Acts flow with the IWSDK dev runtime outside this
   sandbox (or on Quest Browser) and record it.
2. Verify desktop-pointer slab selection; fix or document the gap.
3. Connect a Quest and repeat the guided investigation end to end before
   claiming any headset-tested status.
