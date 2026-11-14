# XR Round 11 — First-contact audit and corrections

Baseline: `d5308c3` on `feat/engram-memory-observatory` (plus `6419979`
and `dffac38`, which touched only `visual/`). This round adds no feature
and reinterprets nothing. It audits what a first-time investigator
actually meets, on a flat screen and in the emulated headset, and fixes
what the audit found. Every claim carries an evidence label.

## How the audit was run

The real client against the real adapter and the declared synthetic
field (9 memories, `field_version` 22). Stages were walked in the IWSDK
managed browser and in the IWER **Meta Quest 3** emulator, asserting on
ECS component values and live UIKit element state. Two further sources
fed the audit: the maintainer's own 1920×1080 captures committed in
`visual/Screenshot from 2026-11-13 *.png`, and a fresh pass of my own.

Automated suites re-run from scratch, not inherited: client 39/39,
typecheck clean, production build ok, adapter regressions 8/8, readiness
5/5.

## Defects found, with severity

Severity follows the brief: 1 blocks an operation, 2 invites a wrong
reading, 3 legibility, 4 orientation, 5 visual quality.

| # | Sev | Defect | Evidence | Correction |
|---|---|---|---|---|
| D1 | 1 | On a flat screen the inspector, containment, counterfactual and verification consoles sit at 45-60 degrees to the side, outside the frame. A judge opening the deployed link could not reach several operations at all. | `r11-before-desktop-step1.png`; maintainer's 17-00-02 capture shows the guide card and inspector sheared at the frame edge | `desktop-look-system.ts`: drag or arrow keys turn the view inside the same seated comfort cone a headset user turns their head through. `Home` recentres. Inert while an immersive session presents. Hero view moved to the seated eye position, fov 58. |
| D2 | 2 | At step 1 the brightest object on the bench is `mem-forged-report` in its red containment cage, not the memory the tour marks. A newcomer is drawn to the wrong object while being told to pick "the marked one". | `r11-before-xr-step1.png` | The marker now lands **on** the target: a ring at the core's base, a white pointer cone above it, and a label that names the target, `START HERE: mem-poison`. White, cone-shaped, no custody hue and no extra brightness, so it cannot be read as evidence. |
| D3 | 2 | Trace drew one label per edge, so four POSSIBLE labels stacked into one unreadable clump and the class of any single edge became ambiguous — the opposite of what the label exists for. | maintainer's 11-18-41 and 17-00-02 captures; `r11-before-trace-labels.png` | One labelled exemplar per class, each riding its own edge at a different fraction and height, alongside the always-visible class legend. Four labels instead of ten. |
| D4 | 3 | Custody tower event labels always extended to the right, so a tower on a left-hand core wrote over the actor registry and the legend. | maintainer's 11-18-41 capture | The tower's labels take the side away from the room centre, from the core's own x. |
| D5 | 3 | First contact showed the welcome question over nine labelled cores, all competing for the same first glance. | `audit-10-xr-welcome` | Core labels appear from the first question onward, not on the welcome card. The cores stay fully visible as objects. |
| D6 | 4 | The guide card sat high and far behind the field; the instruction was not where the eye was. | `r11-before-xr-step1.png` | Guide card brought to 1.52 m at 1.80 m height, scale 1.35; welcome card enlarged and brought to 1.20 m. |
| D7 | 5 | The flat-screen camera sat a metre behind the seat, so the room read smaller than it is and the lower third was empty floor. | `r11-before-desktop-step1.png` | Hero camera moved to the seated eye position. |
| D8 | 1 | **Introduced by the D1 fix and caught before it shipped**: a drag that began on a memory core both carried the core and turned the view. | observed in `after-05-desktop-free-left` during the fix pass | A drag resolves, one frame after the press, whether it belongs to an object. Dragging a core carries the core; dragging the room turns the view; never both. Verified by `D8a` below. |
| D9 | 1 | The relocated inspector console landed on the bench arc, so the leftmost memory cores blocked the ray to its own buttons. Trace could not be pressed. | `G3b`/`G4` failing mid-fix | Every console is now outside the bench ring, checked numerically: no panel sits between 0.90 m and 1.37 m from the bench centre except by design. |

Nothing in MNEME, the adapter contracts, the custody vocabulary, the
causal classes or the preview/commit separation was touched. The only
server change this round is none: the juror account landed in Round 10.

## Verification after the corrections

### Guided tour from a cold page — emulated XR, 12/12 PASS

Cold reload before every run, as a juror opening the link would have.

| # | Check | Result |
|---|---|---|
| G1 | Welcome first; guide, chamber, containment, login and vault hidden; live field state on the card | PASS |
| G2 | Begin: step 1 question, legend revealed, welcome gone | PASS |
| G3 | Selecting `mem-poison` advances to ORIGIN; plain-language state line; chain hidden until asked | PASS |
| G3b | Show full record reveals hash, confidence and chain | PASS |
| G4 | Trace advances to CONSEQUENCES; chamber and edge legend revealed; containment still hidden | PASS |
| G5 | Exclusion forecast advances to ALTERNATIVES; containment and login revealed; vault hidden | PASS |
| G6 | Staged preview advances to INTERVENTION with no commit; vault revealed | PASS |
| G7 | Verified bundle completes the tour | PASS |
| G8 | The whole tour mutated nothing: all nine custody states equal the seed | PASS |
| G9 | Restart returns to step 1 and hides the later surfaces again | PASS |
| G10 | Explore freely reveals every surface | PASS |
| G11 | A flat-screen mouse click on Begin starts the investigation | PASS |

### Flat-screen look control — 2/2 PASS

| # | Check | Result | Evidence |
|---|---|---|---|
| D1a | A click after dragging still activates a control | PASS | Begin pressed at canvas (760, 416) after a full-window drag |
| D8a | Dragging empty space turns the view and displaces no evidence | PASS | all nine core transforms byte-identical before and after the drag |

### Round 9 loop in free mode — emulated XR, 15/15 PASS

Select, inspect, trace, actor authority, cradle staging, both of MNEME's
403 refusals for `agent-ada`, authorized commit with the field and the
actor rack re-reading, bundle verification, chamber collapse. The field
was reset afterwards.

Flake worth recording: in one of three runs the cradle grab needed the
script's second attempt. The grab is a single-frame ray hit; the retry
exists for that reason. Not a regression, but not a clean 3/3 either.

### Suites

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS, 39/39 |
| `npm run build` | PASS |
| `scripts/test-adapter.py` | PASS, 8/8 |
| `scripts/readiness.py` | PASS, 5/5 |

### NOT TESTED

- **Any physical Meta Quest 3.** No device was connected for this round
  either. Everything below can only be settled on hardware:
  - comfort of the 45-60 degree turns over a full session, and whether
    the seated cone should be narrower;
  - real hand-tracking pinch on a 2.4 cm target, and pinch reliability
    at the edges of the tracking volume;
  - text legibility at true IPD and per-eye resolution, where the
    emulator's wide-angle flat capture is not a substitute;
  - frame time, reprojection and thermals on the headset's own GPU;
  - the Quest Browser virtual keyboard for the juror login.
- **Whether a first-time researcher actually understands it.** The tests
  prove the tour can be completed, gates correctly, and never mutates
  without authorization. They cannot prove comprehension. That needs a
  session with people who have never seen MNEME, and it has not been run.

## Running the demonstration

```sh
cd server && ENGRAM_READ_TOKEN=devtoken123 ENGRAM_DEMO_PASSWORD=demo-password \
  python3 -m uvicorn app:app --port 17347 &
cd server && python3 seed_demo_field.py --reset     # clean state
cd client && VITE_ENGRAM_API_BASE=http://localhost:17347 \
  VITE_ENGRAM_READ_TOKEN=devtoken123 npx @iwsdk/cli dev up --headed --open
```

Flat screen: drag to look around, click to select, `Home` to recentre.
Headset: open the dev server's network URL in Quest Browser and press
Enter XR. Juror login for the committing steps: `meta` / `metavr`.

## Files changed

| File | Change |
|---|---|
| `client/src/desktop-look-system.ts` | new — flat-screen look, with the press-ownership rule that keeps grabbing and looking apart |
| `client/src/guide-system.ts` | marker lands on the target core, names it, and points with a cone |
| `client/src/trace-system.ts` | one labelled exemplar per edge class, staggered |
| `client/src/custody-chain-system.ts` | tower labels take the side away from the room centre |
| `client/src/field-system.ts` | core labels hold back on the welcome card |
| `client/src/counterfactual-system.ts`, `client/src/portable-system.ts` | zone content raised clear of the consoles |
| `client/src/index.ts` | registers the look system |
| `client/public/ui/welcome.uikitml` | says how to look around, in one line true of both surfaces |
| `client/public/scenes/main.iwsdk.scene.json` | consoles outside the bench ring, guide and welcome cards closer |
| `client/iwsdk.config.json` | seated hero view, fov 58 |
