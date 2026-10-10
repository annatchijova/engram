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

**Nivel 1 — Provenance Field**, **Nivel 2 — Audited Containment**,
**Nivel 3 — Causal Field**, and **Nivel 4 — Counterfactual Chambers** are
all live. Nivel 1 is read-only inspection of a real MNEME field: custody
chains, authority grants, custody status. Nivel 2 adds the first real
mutation path: an operator logs in as a real MNEME actor, stages a
`QUARANTINE_ACTOR` sweep (sees exactly which memories would be tainted
first), and only then commits — the field re-renders live with the result.
Nivel 3 adds Trace: pulling on a memory's real causal history
(`recall → receipt → decision → impact`, via MNEME's own
`causality.impact()`) and rendering DIRECT, DERIVED, and POSSIBLE as
genuinely distinct — different geometry, different line style, never
different distances of the same thing. Nivel 4 is this README's own
defining interaction, made real: MNEME's `counterfactual.compare_worlds()`
run both directions — excluding more needs no authority, revealing what
containment withheld needs the Nivel 2 session, and MNEME's own
`authority.gate` is what enforces that, not the adapter — rendered as a
translucent, spatially distinct "ghost" chamber, never a recolor of the
real field. All of Nivel 3 and 4 are fully read-only and fully reversible.

- `server/` — a FastAPI adapter (`app.py`) over the sibling MNEME
  repository. Almost every endpoint is read-only; the one exception
  (`POST /api/v1/actors/{id}/quarantine`) is clearly bannered in the file
  and is the only place in all of ENGRAM that writes to MNEME, through
  MNEME's own `trust.quarantine_actor` — never a raw SQL write.
  `seed_demo_field.py` seeds a demo field the same way, using only MNEME's
  own authorized API. MNEME stays a separate service; the browser never
  touches SQLite directly.
- `client/` — a seated WebXR/IWSDK experience. Memories render as an arc of
  nodes colored by `custody_status` against a fixed, legended map; selecting
  one opens a panel with its real content, hash, and custody chain. A
  containment console lets a logged-in operator stage and commit a
  quarantine, Stage never mutating and Commit being the one explicit,
  separate gesture that does (ray/pinch in XR, mouse-click on desktop).
- **Known limitations, not hidden:** read access is a single shared bearer
  token (`ENGRAM_READ_TOKEN`); the Nivel 2 login is one demo credential
  with an in-memory, process-lifetime session — a real externally-bound XR
  actor identity is still open. Both are named in `server/app.py`'s and
  `server/README.md`'s own words, not glossed over.

The target device is a hands-first, seated WebXR/IWSDK experience for the Meta VR Start Developer Competition 2026.

## License

Apache License 2.0. Copyright 2026 Anna Tchijova.
