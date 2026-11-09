/**
 * ENGRAM shared projection — the vocabulary both surfaces render.
 *
 * Single source today is canvas/canvas-state.ts; this module re-exports
 * it under a surface-neutral name so XR can adopt the same import when
 * the uncommitted XR WIP is ready, without a second copy to drift.
 * tests/canvas-invariants.test.mjs pins hex parity with XR
 * field-system.ts. Meanings come from MNEME responses, never from here.
 */
export { CUSTODY_PRESENTATION, EDGE_LABEL } from './canvas/canvas-state.js';
export type { EdgeClass } from './canvas/canvas-state.js';
