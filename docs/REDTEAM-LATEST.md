# Red Team — Latest Round

Method: predictions stated before probes; CONFIRMED only with an
executed run. Threat model: attacker controls client-sent bytes and
local presentation storage; cannot forge MNEME seals, server secrets
or another actor's grants. Base: feat/engram-canvas-bridge @ 9c205a3.

## Findings

### RT-1 — Large graph escapes the board (fixed)
Prediction: ring layout radius grows with node count, so a 200-node
field lands off-board. Observed: node at y=-6619 (test R7 red).
Level: CONFIRMED BY INDUCTION. Fix: bounded packing over 40 nodes,
content bounds grow the scrollable viewport and SVG viewBox with the
layout (siblings audited: boot, graph-layout and reset paths, edge
layer). Regression: tests 22/22.

### RT-2 — Presentation exports leak authority data (falsified)
Prediction: JSON Canvas or saved layout might carry hashes, tokens or
confidence. Observed: neither contains them; layout holds only x/y.
Level: FALSIFIED as an exploit; the loss warnings stand.

### RT-3 — XR scene is visually weak (accepted, deferred by user)
Slabs, zones and frames are implemented, but composition, lighting
and readability have never been seen in a headset or simulator.
Level: CODE FACT (code) / UNVERIFIED (appearance). The user accepted
this state explicitly ("hay tiempo"); no cosmetic claim is made.

### RT-4 — Adapter authority boundaries (re-confirmed)
test-adapter.py on a throwaway field: 401 unauthenticated, 404
actor-vs-memory, preview without mutation, 409 stale commit, 403
unauthorized widening, 200 audited widening, bundle VERIFIED,
tampered bundle rejected. 8/8, CONFIRMED BY INDUCTION.

## Discarded vectors

Session tokens in layout storage (only positions persist), custody
promotion through focus dimming (exposure language, tested), and
hypothetical leakage into the factual board (partition tested with a
mutation control in Round 2) produced no effect.

## Not examined

Browser rendering at any viewport (no Chromium), Quest/simulator
behaviour, simultaneous-race commits, malformed-payload fuzzing.
Each reopens on the falsifier named in ENGRAM-REDTEAM-ROUND3.md.
