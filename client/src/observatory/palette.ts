/**
 * ENGRAM Memory Lab — presentation palette.
 *
 * Zone accents and architectural tints only. Nothing here carries evidence
 * meaning: custody_status colors live exclusively in field-system.ts
 * (CUSTODY_COLOR), trace edge classes in trace-system.ts (TRACE_STYLE),
 * and the counterfactual ghost violet in counterfactual-system.ts. Those
 * maps are the only places a MNEME value is allowed to pick a color.
 */
export const OBS = {
  // Room
  background: '#070b12',
  floor: '#0a0f17',
  floorGrid: '#172230',
  wall: '#0e1522',
  trim: '#1d2a3b',
  metal: '#2a3442',
  glass: '#9fd0ff',
  // Zone accents (architecture, consoles, light pools)
  evidence: '#5fc9ff',
  provenance: '#7fd4a8',
  containment: '#e0a62b',
  chamber: '#b060ff',
  vault: '#4be0a0',
  // Interaction feedback (never a status)
  hover: '#ffffff',
  selected: '#5fc9ff',
  // Preview / staged (never a committed status)
  staged: '#e0a62b',
} as const;

/** Seated lab origin: player sits at (0, 0, 0) facing -Z. */
export const OBSERVATORY = {
  benchCenter: { x: 0, y: 0, z: -0.35 },
  benchRadius: 1.15,
  benchSpanDeg: 120,
  coreHeight: 1.08,
  actorRack: { x: 0, y: 1.3, z: -2.35, spread: 2.3 },
  chamber: { x: -2.35, y: 0, z: -1.45, radius: 0.8 },
  vault: { x: 2.35, y: 0, z: -1.45 },
  /** Intervention cradle: within seated arm's reach, right of the field,
   * clear of both the bench arc and the containment console. */
  cradle: { x: 1.10, y: 0.92, z: -0.30 },
} as const;
