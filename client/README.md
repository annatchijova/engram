# ENGRAM client — Nivel 1 Provenance Field + Nivel 2 Audited Containment

Seated WebXR/IWSDK client. Fetches a real MNEME field from `server/app.py`
and renders it. One real mutation path exists: log in, stage a quarantine,
see the exact preview, commit — see `src/containment-system.ts`.

This project uses `iwsdk.config.json` for declarative scene, asset, component,
XR, and emulator configuration. Application systems remain explicit in
`src/index.ts`.

## Run

Start the adapter first (see `../server/README.md` if present, or the repo
root README), then:

```sh
cp .env.example .env   # set VITE_ENGRAM_API_BASE / VITE_ENGRAM_READ_TOKEN
                        # to match how you started server/app.py
npm install
npm run dev
```

Use the Runtime and Editor controls in the managed browser to switch between
the running experience and its authored scene. On desktop, `canvasPointerEvents`
(set in `iwsdk.config.json`) lets mouse-click select a memory node — emulated
input, not a Quest hand-tracking claim.

## Layout

- `src/field-system.ts` — fetches `/api/v1/field/overview` and
  `/api/v1/memories`, lays memories out as an arc, colors each node by
  `custody_status` via the fixed map in the same file, populates the legend.
- `src/selection-system.ts` — on `Pressed`, fetches
  `/api/v1/memories/{id}` and `/api/v1/memories/{id}/custody` and fills the
  detail panel.
- `src/engram-api.ts` — the only module that talks to the adapter.
- `public/ui/legend.uikitml`, `public/ui/detail.uikitml` — the Nivel 1 panels.
- `src/login-overlay.ts` + `index.html`'s `#engram-login` — plain DOM login
  (not UIKitML — unverified input-widget support), fills `src/session.ts`
  (in-memory only, lost on reload by design).
- `src/containment-system.ts` + `public/ui/containment.uikitml` — Stage
  (calls the read-only preview endpoint, never mutates) and Commit (the
  one mutating call in the whole app) for the single demo target actor
  `pipeline-logs`. On commit, calls `FieldSystem.refresh()` so the field
  re-renders with the new `custody_status` colors immediately.

- Minimal scene walkthrough: https://iwsdk.dev/guides/01b-minimal-scene.html
- XR-enabled projects — IWER emulator controls: https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls
