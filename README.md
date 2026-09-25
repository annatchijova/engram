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

The architectural destination and investigation are documented in [ENGRAM-ARCHITECTURAL-INVESTIGATION.md](ENGRAM-ARCHITECTURAL-INVESTIGATION.md). Implementation has not started yet.

The initial target is a hands-first, seated WebXR/IWSDK experience for the Meta VR Start Developer Competition 2026.

## License

Apache License 2.0. Copyright 2026 Anna Tchijova.
