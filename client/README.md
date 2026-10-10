# ENGRAM client — Nivel 1-5

Seated WebXR/IWSDK client. Fetches a real MNEME field from `server/app.py`
and renders it. One real mutation path exists: log in, stage a quarantine,
see the exact preview, commit — see `src/containment-system.ts`. Nivel 3
adds "Trace impact" and Nivel 4 adds the Counterfactual Chamber: both
fully read-only, fully reversible. Nivel 5 adds bundle export with
independent offline verification, and a stale-snapshot precondition on
the one mutation.

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
- `src/trace-system.ts` + `src/selected-memory.ts` — "Trace impact" button
  on the detail panel calls `GET /api/v1/memories/{id}/impact` (MNEME's
  real `causality.impact()`) and draws lines from the traced node: solid
  bright DIRECT lines to new receipt/decision markers (octahedron/box —
  deliberately not spheres, so they never read as memory nodes), dashed
  amber DERIVED lines to other memory nodes, thin low-opacity gray
  POSSIBLE lines that never visually compete with the causal ones.
  Selecting a different memory or closing the panel clears every traced
  entity (`entity.dispose()`), so Trace stays fully reversible.
- `src/counterfactual-system.ts` + `public/ui/counterfactual.uikitml` —
  two buttons: "Exclusion forecast" (no login, narrowing only — MNEME
  needs no capability for this) and "Containment effect" (needs the
  Nivel 2 session — widening discloses what custody withheld, and
  MNEME's own `authority.gate` enforces that, not this file). Renders the
  delta as a translucent violet "ghost" cluster in its own offset
  region — never a recolor of the real field, which the investigation
  doc calls insufficient — tied back to real nodes by thin lines.
  "Collapse chamber" disposes every chamber entity; the factual field is
  never touched by any of it.
- `src/portable-system.ts` + `public/ui/portable.uikitml` — "Export &
  Verify Bundle" calls `GET /api/v1/bundle/export` and shows exactly what
  the server's independent `verify_offline.py` subprocess printed, never
  a synthesized verdict. "Download bundle.json" triggers a real browser
  file download (`Blob`/`URL.createObjectURL`) — this is ENGRAM's own
  hosted page, not a sandboxed artifact viewer, so that's legitimate here.
- `src/containment-system.ts` also now captures `field_version` from the
  Stage preview and sends it back on Commit — a Commit staged against a
  field that has since moved is rejected by the server (409), distinctly
  worded from "already QUARANTINED."

- Minimal scene walkthrough: https://iwsdk.dev/guides/01b-minimal-scene.html
- XR-enabled projects — IWER emulator controls: https://iwsdk.dev/guides/02-testing-experience.html#iwer-controls

## Deploy (Vercel)

```sh
npm run build                         # -> dist/
npx -y vercel@latest whoami           # first time: interactive login
npx -y vercel@latest deploy --prod --yes
```

Set `VITE_ENGRAM_API_BASE` (the deployed adapter's `https://...fly.dev`
URL) and `VITE_ENGRAM_READ_TOKEN` as Vercel project environment variables
before building — they're baked into the static bundle at build time,
same as locally. `vite.config.ts` already sets `base: './'`, so the build
works unmodified at the Vercel root or any subpath.

**Named limitation, now genuinely public, not just local**: the read
token is readable by anyone who opens devtools on the deployed site. Only
acceptable because the adapter's read endpoints are, by design, the only
thing that token unlocks — see `server/app.py`'s module docstring.
