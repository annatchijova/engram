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
