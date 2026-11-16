# XR Round 11 — Art Direction and XR Experience

Baseline: `6bddc8c` on `main` (tag `xr-art-base` in the working clone).
Work branch: `claude/gifted-lovelace-tnvdd6`, developed in an isolated git
worktree. Presentation layer only: MNEME, the adapter (`server/`), the
Canvas 2D surface, deployment files and `iwsdk.config.json` are untouched.
Every claim below carries an evidence label and nothing is promoted beyond
what was executed.

ENGRAM is not a forensic tool, and nothing in this round makes it look
like one. The room is an observatory: an instrument for looking at a
memory system as it is.

## The one rule

**Hue is evidence. Structure is neutral.**

Before this round the room had seven accent colours (cyan bench, mint
vault, amber containment, violet chamber, blue actors, plus the custody
colours). Two of them collided with data: the containment console and the
intervention cradle were drawn in `#e0a62b`, the exact TAINT_FLAGGED hex,
and the verification pedestal glowed in the VERIFIED verdict colour before
anything had been verified.

Now architecture, typography and interaction feedback use the two tones
of the ENGRAM mark only: ink (`#0b0d12`) and ivory (`#EEE9DF`). A
saturated colour in the field of view always traces back to a value MNEME
returned:

| Colour | Means | Declared in |
|---|---|---|
| custody green / amber / red / grey | `custody_status` of a memory | `field-system.ts` `CUSTODY_COLOR` (unchanged hexes) |
| cyan / amber / dim amber / grey | causal edge class | `trace-system.ts` `TRACE_STYLE` (unchanged) |
| violet `#B8A6EC` | sealed hypothetical | `counterfactual-system.ts` `GHOST_COLOR` (was `#b060ff`; now the mark's own violet) |
| mint `#4be0a0` / red / amber | the verifier's verdict | `portable-system.ts` `VERDICT_COLOR` (unchanged) |
| red on a totem | actor status QUARANTINED | `actor-system.ts` (ACTIVE is now neutral ivory, was blue) |
| copper `#D58B58` | the operator's intervention station (zone tint, not data) | `palette.ts` `OBS.containment` |
| amber ring, wireframe | staged preview: "would be TAINT_FLAGGED" | `containment-system.ts` (unchanged, deliberate) |

Pinned by tests `A1`, `A2` and the existing `O1`-`O3`.

## What changed, by brief item

### 1. Spatial composition

- **The field is the protagonist.** The recorded memories stand on one
  cantilevered graphite arc in front of the seated observer. Nothing is
  placed between the eye and the arc any more.
- **Captions moved under the objects.** Each memory's caption hangs on the
  viewer-facing edge of the arc, below the ivory limb line, the way a
  specimen is captioned. The air above the field is now reserved for
  things that appear because of an action: the custody tower, the causal
  arcs, the guide marker.
- **Three depth tiers** from the seated eye: the field (about -5 deg), the
  actor registry behind it (+3 to +10 deg), the guide and legend above
  (+15 deg and up). The welcome card and the hover card share one slot in
  the band between the field and the registry; neither covers a plate from
  a seated or a standing eye.
- **The room is an instrument, not a set.** Walls, ceiling strips, columns,
  bench legs, the two prop consoles and the drifting dust are gone. What
  remains: a dais engraved with concentric rings and an unnumbered 2-degree
  limb scale, an open dome of meridians at the edge of fog, a horizon
  band. The engraving is concentric and has no radial lines on purpose, so
  the architecture can never be read as a relationship between zones or
  memories.

### 2. Identity: material, light, colour, type, geometry

- **The memory is the object on the ENGRAM poster.** A memory is now an
  *engram plate*: three sheets of glass on a graphite foot, the middle
  sheet carrying the custody mark (the diamond of the ENGRAM mark) inside
  a custody-coloured frame. Shape and size are identical for every memory.
  QUARANTINED keeps its containment frame, in addition to its colour.
- **Three materials**: graphite (structure), ivory linework (engraving,
  edges, focus), glass (memories). No physically-based glass: the layered
  look comes from three real sheets and their parallax (test `A8`).
- **Light**: one warm key, one cool rim, sky fill, plus the two zone lamps
  the systems drive. Five lights instead of eight.
- **Type**: Inter for words (the family the UIKit panels already use), IBM
  Plex Mono for identifiers and hashes, both bundled (OFL, `@fontsource`).
  An all-caps bold line is tracked out and reads as a heading. Caption
  plates are an ink scrim with one hairline rule in the accent colour; the
  rounded outlined boxes are gone.
- **Geometry**: chamfers, square caps and brackets, taken from the mark.

### 3. XR interaction

Nothing was removed from the interaction grammar: a short pinch/trigger on
the ray selects, a held one carries (`DistanceGrabbable`, unchanged), every
panel control keeps its id and its handler.

- **Focus brackets.** Four ivory corner brackets (the bracket of the mark)
  frame the plate under the pointer, wide and at 60 % opacity; on
  selection a second set closes onto the plate at full strength. They are
  the room's one focus indicator and are identical for every status.
- **Attention opens the plate.** Hover parts the three sheets slightly;
  selection opens them fully. Selection no longer scales a memory (it was
  1.22x): size never means anything here (test `A3`).
- **The caption answers the pointer.** An attended or open plate swaps its
  two-line caption for the long one with the plain-language gloss.
- **Buttons state their role.** One ivory primary action per panel;
  secondary actions are quiet; the single mutating action (Commit) is the
  only red control in the room.

### 4. Legibility

- Labels: 1600 px/m, mip-mapped with anisotropy, never smaller than 24 px
  of em height (1.5 cm; 0.57 deg at 1.5 m), and a line that does not fit
  now **wraps** instead of being cut with an ellipsis. Before, the gloss
  under every TAINT_FLAGGED memory was truncated mid-sentence.
- Panels were re-laid out against a measured scale: **one UIKit unit
  renders as 0.77 cm at scale 1** in the emulated Quest 3 runtime (the
  welcome panel, 78 units wide, measures 0.60 m). Earlier rounds assumed
  1 cm. Test `A6` recomputes the visual angle of every panel text class
  from the seated eye and fails under 0.40 deg.
- Panel rotations are now pitch-about-own-axis after yaw (the scene's XYZ
  Euler order rolls a yawed panel if pitch is written into X directly).

Measured text angles from the seated eye (em height; Quest 3 resolves
about 25 px per degree):

| Panel | Distance | Primary reading text | Smallest text |
|---|---|---|---|
| welcome | 1.80 m | question 1.44 deg, body 0.65 deg | eyebrow 0.45 deg |
| guide | 2.12 m | question 1.08 deg, body 0.64 deg | eyebrow 0.43 deg |
| inspector | 1.41 m | title 0.97 deg, content 0.70 deg | eyebrow 0.46 deg |
| hover card | 1.83 m | id 0.69 deg, excerpt 0.63 deg | hint 0.45 deg |
| intervention | 1.41 m | heading 0.92 deg, preview 0.59 deg | eyebrow 0.46 deg |

The far panels (legend, login, chamber and vault consoles, authority) sit
between 0.40 and 0.75 deg. They are readable in the emulator; whether
0.4-0.5 deg is comfortable on a physical headset is **not tested** (see
Limitations).

### 5. Motion

Policy: **the field is still unless the system changed.** The idle bob,
the crystal spin, the halo rotation, the breathing bench strip and the
dust are removed. A plate moves for four reasons only, each a real event,
each identical for every custody status:

| Motion | Cause |
|---|---|
| Arrival: plates stand up one by one in the server's list order; the limb and its graduations light with the fraction that has arrived | the field was read from MNEME, or the observer entered the immersive session. A failed read lights nothing. |
| Sheets part, brackets close in | a pointer rests on the plate |
| Sheets open fully, custody tower rises block by block in `seq` order | the record was opened |
| Mark and frame move from the old declared hue to the new one while the sheets open and close once | MNEME reported a different `custody_status` after a refresh |

Causal edges are drawn as **arcs over the field**, revealed in the order
the impact report listed them. A straight chord between two plates on the
same arc ran in front of every plate between them. The arc's height
depends only on the distance between its endpoints, by the same rule for
every class (test `A9`), so it carries no meaning. DIRECT and DERIVED keep
their travelling pulse; POSSIBLE stays a motionless hairline and keeps
"NOT CAUSAL" on the edge itself. The other edges carry their class name
only; the sentence explaining each class is in the legend once instead of
on every edge.

No relationship is drawn that MNEME did not return. No memory position
encodes anything: the order on the arc is still the server's list order.

### 6. The first ten seconds

Entering the session: an ink room, a dome, an unlit arc. After a beat the
memories stand up left to right, each caption appearing as its plate
settles, and the ivory limb brightens with them. Then one card, in the
band above the field: *Can this memory be trusted?* with one ivory button.

### 7. Performance

Measured in this environment with the same harness on both builds
(Chromium, SwiftShader **software** rasteriser, 1600x900, non-immersive
view, field loaded, welcome state). Draw calls and triangles are counted
by wrapping the WebGL2 draw functions; they are exact for the frame
rendered. The frame rate is a CPU rasteriser's and is only meaningful as
a **relative fill-cost indicator** between the two builds.

| Metric | Base `6bddc8c` | This round |
|---|---|---|
| draw calls per frame | PERF_BASE_CALLS | PERF_NEW_CALLS |
| triangles per frame | PERF_BASE_TRIS | PERF_NEW_TRIS |
| frames per second (software) | PERF_BASE_FPS | PERF_NEW_FPS |

Design decisions taken for the device, independent of the numbers above:
no `MeshPhysicalMaterial` (clearcoat/transmission), five lights instead of
eight, unlit materials for all linework and edges, one instanced draw call
per causal edge (was up to 14 meshes per dashed edge), no per-frame buffer
upload for ambience (the dust rewrote 420 vertices every frame), shared
geometry for every memory (test `A4`), no per-frame allocation in any
`update()` touched.

**No Quest frame time is claimed.** No headset was available.

## A defect found and fixed: runtime text that never rendered

While checking legibility against pixels instead of UIKit state, the
guide's body and action lines, the inspector's content, the trace result,
the counterfactual result, the verifier output, the authority chain and
the login status were all **blank**. This is present at the baseline
`6bddc8c`, and is visible in the repository's own
`visual/observatory/02-inspect.png` (the title is followed directly by the
button).

Root cause, verified in `node_modules/@drawcall/uikitml/dist/instantiate.js`:
a `<span>` is a container whose `Text` child is only created when the
markup contains a text node, and that child reads
`parent.properties.text ?? value`. A span authored empty
(`<span id="detail-content"></span>`) has no `Text` child, so a later
`setProperties({ text })` has nothing to draw with. Spans that started
with placeholder text (`detail-title`, `legend-field`) worked, which is
why the defect was partial and easy to miss. Rounds 9 and 10 asserted on
UIKit element state, where the text property was correct.

Fix: every id-bearing span now starts with a zero-width space (U+200B) as
its text node. No system code changed. Pinned by test `A7`. 19 spans in 9
panels were affected.

Variants checked: `button` elements (always authored with text, not
affected); `input` elements (not text containers, not affected); spans
without an id (static, not affected). The step-progress dots (`● ○`) are a
separate case: those glyphs are missing from the panel font and render as
identical squares, so that line is hidden; the step number is already in
the eyebrow ("STEP 2 OF 5").

## Application elements vs emulator and editor tools

Identified before changing anything, so no required control was removed
as decoration.

| Element | Belongs to | Treatment |
|---|---|---|
| "Enter XR" pill, top centre (flat view) | IWSDK session offer (`xr.offer: "always"`) | untouched |
| White rays from the controllers, cursor dot | IWSDK input visuals | untouched |
| Controller models, transform gizmos, "Controller [L]/[R]" panels, top toolbar, "Remote Control Active" badge | IWER emulator dev UI | not part of the app; hidden only in this round's captures |
| Ten UIKit panels and every control in them | application | all kept; restyled, re-placed, ids and handlers unchanged |
| Memory plates, totems, cradle, chamber, vault, custody tower, causal edges, staged rings, guide marker, transport-state marks | application | all kept; redrawn |
| Walls, ceiling strips, columns, bench legs, two side consoles, their two coloured lamps, dust, selection light beam | decoration | removed |

## Verification actually executed

Environment: Linux container, Chromium 1243 (Playwright), **SwiftShader
software rendering**, IWER emulated **Meta Quest 3** injected by the IWSDK
Vite plugin, live adapter on `:17347` against MNEME (`annatchijova/mneme`
at its current `main`, cloned read-only) and the seeded synthetic field
(9 memories, `field_version` 22). The IWSDK managed browser could not be
used (its Chromium download is blocked by the network policy here), so the
emulator was driven directly through `IWER_DEVICE.remote.dispatch`
(`set_transform`, `look_at`, `animate_to`, `select`), which is the
interface the IWSDK CLI itself uses.

Software rendering runs this scene at about 2 frames per second. UIKit
only emits `click` when press and release fall within 300 ms, so the
harness slows the page's clocks by 8x; the application then experiences a
normal frame cadence. Screen recordings are sped up 8x to real experience
time.

### Guided tour, emulated XR, controller ray only

| # | Check | Result | Evidence |
|---|---|---|---|
| V1 | Immersive session starts; arrival choreography plays on `sessionstart` | **PASS** | video frames at 0.6 / 1.2 / 1.8 / 2.6 s: empty arc, 4 plates, 8 plates, 9 plates with captions and lit limb |
| V2 | Welcome card does not cover any plate, seated (1.20 m) or standing (1.62 m) | **PASS** | `01-welcome-seated.png`, `01b-welcome-standing.png` |
| V3 | Ray click on Begin starts the tour; guide shows question, body and action | **PASS** | `02b-step1-guide.png`: "Which memory deserves our attention?" with its paragraph (blank at baseline) |
| V4 | Hover: brackets, long caption with gloss, hover card | **PASS** | `03-hover.png` |
| V5 | Ray select on `mem-poison`: brackets close, sheets open, tower rises, inspector shows state line and content | **PASS** | `04-selected.png`, `05-inspector.png` |
| V6 | Ray click on Trace impact: arcs, DIRECT markers beside the tower | **PASS** | `06-trace.png`; guide advanced to "What depended on this information?" |
| V7 | Exclusion forecast in the chamber | **PASS** | `08-chamber.png`; guide advanced to step 4 |
| V8 | Stage quarantine: amber PREVIEW ring on the field, nothing committed | **PASS** | `10-staged.png`, `10b-staged-field.png` |
| V9 | Export and verify: verifier output rendered, tour completes | **PASS** | `12-verified.png`, `13-complete-guide.png`: "The investigation is preserved." |

The tour was completed twice end to end this way. It mutates nothing (no
commit is part of it).

### Suites

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS**, 48/48 (39 existing unchanged + 9 new art-direction invariants `A1`-`A9`) |
| `npm run build` | BUILD_RESULT |

### NOT TESTED

- **Any physical headset.** Comfort, real text legibility at real optics,
  hand-tracking pinch, on-device frame time and thermals are unverified.
  Everything about "reads comfortably on Quest" in this document is a
  computed visual angle, not an observation.
- **A GPU.** All rendering here was software. Glass, transparency sorting
  and anti-aliasing can look different on real hardware.
- **Hand tracking.** Interaction was driven through the emulated
  controller ray.
- **Grab-and-carry** of a plate or totem, the cradle docking by physical
  placement, the operator login, a real commit, the containment-effect
  counterfactual and the authority inspector were not re-exercised this
  round. Their code paths are unchanged except for label styling and
  positions; that is an inference, not a test.
- **Custody-change motion.** The colour transition with the sheets opening
  runs only after a real commit changes a status; it was not triggered
  here.
- **Usability with people.** None of this proves a newcomer finds the
  experience clear or memorable.

## Known limitations and open problems

1. **Explore mode is crowded.** With every surface revealed (after the
   tour, or via Explore freely) ten panels surround the seat. The guided
   path stages them well; the free mode needs a pass that parks inactive
   consoles.
2. **Far consoles are at the legibility floor.** Chamber and vault
   consoles sit 2.3 m away at 0.43-0.49 deg for their body text. Bringing
   them closer collides with the field arc and with the chamber's own
   contents; the right fix is to attach those two consoles to the seat
   side rather than to the instruments.
3. **The chamber's interior typography was only recoloured.** Its rails,
   ghosts and summary keep their Round 9 layout and sizes.
4. **The guide panel sits high** (centre at 2.04 m, about 20 deg above a
   seated eye). The band below it is needed for the registry and for the
   tower and arcs. A wrist- or seat-anchored guide would be more
   comfortable; that is a larger interaction change.
5. **Hover has no feedback on panel buttons.** UIKitML hover styling is
   not among the verified properties in this project's UI guide and was
   not attempted.
6. **Actor totems keep their primitive shapes** (sphere-ish, capsule,
   cylinder); only their colour logic and captions changed.
7. **The limb scale is unnumbered by design**, and the dome is purely
   architectural. If either reads as decoration on a headset, the dome
   lines are the first thing to drop.
8. **Emulator FOV.** The captures use the emulator's wide projection, at
   about 16 px per degree, coarser than a Quest 3. Small text looks worse
   in them than the computed angles imply; composition looks more distant.
9. Two dependencies were added (`@fontsource/inter`,
   `@fontsource/ibm-plex-mono`, latin subsets, about 100 kB of woff2).

## Integration

The change is confined to `client/` plus this document and
`visual/observatory/round11/`.

| Area | Files | Conflict risk with parallel work |
|---|---|---|
| Presentation modules | `client/src/observatory/*` (palette, labels, memory-core, environment, handles, new `typography.ts`) | none unless also edited |
| Systems, presentation parts only | `field-system.ts` (materials, captions, `update()`), `trace-system.ts` (edge geometry, `update()`), `custody-chain-system.ts`, `guide-system.ts`, `counterfactual-system.ts`, `containment-system.ts`, `actor-system.ts`, `portable-system.ts`, `ambience-system.ts`, `onboarding-system.ts` (two colour literals) | **`field-system.ts` and `trace-system.ts` were substantially rewritten**: a parallel functional edit there will conflict and should be re-applied on top |
| Panels | `client/public/ui/*.uikitml` | every id and class of a wired control is preserved; a parallel edit to panel text will conflict textually |
| Scene | `client/public/scenes/main.iwsdk.scene.json` | transforms only |
| Entry | `client/src/index.ts` | 4 lines: fonts are awaited before `World.create` |
| Package | `client/package.json`, `package-lock.json` | two dependencies, one test file added to `npm test` |

Not touched: `server/`, `scripts/`, `client/src/engram-api.ts`,
`session.ts`, `login-system.ts`, `selection-system.ts`,
`hover-preview-system.ts`, the onboarding state machine and tour script,
`client/src/canvas/*`, `iwsdk.config.json`, `vite.config.ts`, `README.md`,
any deployment or Hugging Face file.

API changes inside the presentation layer that another branch could trip
on:

- `ObservatoryHandles` lost `benchStrip`, `dust`, `dustVelocity`; gained
  `limb`, `graduations`. `tickObservatory(h, delta, fieldPresence)`.
- `MemoryCore` gained `plates`, `spread`, `arrival`; `capsule` is the front
  sheet. `CoreMaterials` gained optional `edge`.
- `makeLabel` keeps its signature. `LabelLine` gained optional `font`.
  `background` now only switches the ink scrim on (its alpha is kept);
  `border` is the colour of the top rule.
- `OBSERVATORY.coreHeight` is 0.98 (was 1.08): the plate's foot rests on
  the arc. `OBSERVATORY.actorRack` moved up and back.

To integrate: merge or rebase the branch onto the current `main`; if
`field-system.ts` or `trace-system.ts` conflict, keep this round's
`update()` and geometry and re-apply the functional change by hand. Then
`cd client && npm ci && npm run typecheck && npm test && npm run build`.

## Files in `visual/observatory/round11/`

Before/after pairs from the same emulator pose, the tour stills referenced
above, and `engram-round11.mp4` (30 s, the first contact through the trace,
recorded in emulated XR and sped up to real experience time).
