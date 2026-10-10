# ENGRAM

**Geometry of Evidence**  
*Memory Has Geometry.*

ENGRAM is an immersive XR environment for inspecting and operating on computational memory as spatial, verifiable structures.

It is being designed on top of [MNEME](https://github.com/annatchijova/mneme): MNEME decides and proves; ENGRAM makes those decisions inspectable and operable through the body.

## Why XR

ENGRAM is not a 3D graph viewer. Its defining interaction is counterfactual analysis: a user can hold a factual world and a sealed hypothetical world apart, then inspect how memories, rankings, claims, and decisions diverge.

The spaces must remain physically and semantically distinct. A counterfactual projection is never silently treated as factual state, and ending a comparison never merges the worlds.

## Interaction boundary

Spatial state is a projection, never the epistemic authority:

```text
gesture
  → candidate intent
  → semantic confirmation
  → typed command
  → MNEME authorization and preconditions
  → audited transaction
  → new authoritative snapshot
  → XR projection
```

A physical drop never mutates state by itself. Operations such as quarantine are staged, previewed, explicitly committed, authorized by MNEME, and then reflected in XR.

Every projection is scoped to an explicit world and snapshot. Factual worlds may mutate only through authorized commands. Counterfactual worlds are isolated, queryable comparisons and cannot create factual decisions.

## Geometry is evidence-bearing

Spatial form must communicate something true about the underlying state. Direct, derived, derived-unattested, and possible evidence remain distinct.

Proximity does not automatically mean causality. Size does not mean authority. Brightness does not mean truth. Weight must not collapse confidence and standing into one signal. A line does not generically mean “related.”

## Project status

The architectural destination and investigation are documented in [ENGRAM-ARCHITECTURAL-INVESTIGATION.md](ENGRAM-ARCHITECTURAL-INVESTIGATION.md).

**Nivel 1 — Provenance Field is in progress.** Read-only inspection of a real
MNEME field: custody chains, authority grants, and custody status, with no
mutation path anywhere in the client.

- `server/` — a read-only FastAPI adapter (`app.py`) over the sibling MNEME
  repository, plus `seed_demo_field.py`, which seeds a demo field using only
  MNEME's own authorized API (store/reinforce/supersede/quarantine — never a
  raw SQL insert). MNEME stays a separate service; the browser never touches
  SQLite directly.
- `client/` — a seated WebXR/IWSDK experience. Memories render as an arc of
  nodes colored by `custody_status` against a fixed, legended map; selecting
  one (ray/pinch in XR, mouse-click on desktop) opens a panel with its real
  content, hash, and custody chain.
- **Known limitation, not hidden:** the adapter's auth is a single shared
  bearer token (`ENGRAM_READ_TOKEN`), not the externally-authenticated XR
  actor identity the architecture calls for. Acceptable for now only because
  Nivel 1 exposes zero mutating endpoint — see `server/app.py`'s docstring.

The target device is a hands-first, seated WebXR/IWSDK experience for the Meta VR Start Developer Competition 2026.

## License

Apache License 2.0. Copyright 2026 Anna Tchijova.
