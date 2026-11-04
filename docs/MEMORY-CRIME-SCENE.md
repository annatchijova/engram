# The Memory Crime Scene — implementation report

## Completed

- XR memory objects are now flat evidence slabs (`BoxGeometry`
  0.17 x 0.11 x 0.025 in `field-system.ts`) taking the shared custody
  material, replacing unexplained spheres. Custody color still comes
  only from the server status map; size means reading distance, never
  authority or truth. Typecheck and production build pass.
- 2D framing: selecting a memory centres it in the board
  (`cardScrollTarget`, tested), fit uses recorded bounds, and the
  inspector offers copy controls for hashes.
- The five-stage story (Discover, Trace, Follow the Consequence,
  Compare, Preserve) maps onto the existing stepper and real MNEME
  outputs: mem-poison (TAINT_FLAGGED, source pipeline-feeds
  QUARANTINED), the recorded decision, mem-note attested and
  mem-omar-note unattested, the sealed exclusion/containment deltas,
  and the independently verified bundle.

## Partial

- XR zones are now composed in the scene graph: Evidence Field arc at
  centre, Provenance Trail (legend) left, Decision/Detail front,
  Counterfactual console low over its violet ghost chamber (separate
  arc, y 0.75, z -2.3), Containment far right. Semantic zoom is
  panel-based (overview nodes, investigation panels at 1.15x,
  inspection detail at 1.35x), not distance-based LOD. The five-stage
  XR guidance rides the Next Step/onboarding panels from the
  uncommitted migration; its completion on device is unverified.

## Unverified

- No Quest device is connected and the XR Simulator frontend is not
  running: slab readability, selection comfort, transitions and frame
  rate have zero executed evidence. Desktop fallback (this Canvas)
  carries the full 90-120 second journey today.
