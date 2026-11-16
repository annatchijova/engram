/**
 * ENGRAM Memory Observatory — the art-direction tokens.
 *
 * One rule governs the whole room: HUE IS EVIDENCE, STRUCTURE IS NEUTRAL.
 * Architecture, typography and interaction feedback are drawn in ink and
 * ivory only (the two tones of the ENGRAM mark). A saturated colour in the
 * field of view therefore always traces back to a MNEME value:
 *   - custody_status colours live exclusively in field-system.ts
 *     (CUSTODY_COLOR),
 *   - causal edge classes in trace-system.ts (TRACE_STYLE),
 *   - the hypothetical violet in counterfactual-system.ts (GHOST_COLOR),
 *   - the verifier's verdict in portable-system.ts (VERDICT_COLOR).
 * Nothing in this file carries evidence meaning. The two zone tints kept
 * here are the mark's own secondary tones: violet for the sealed
 * hypothetical, copper for the operator's intervention. Neither is a
 * custody hex (pinned by tests O2 and A1).
 */
export const OBS = {
  // Ink: the room itself.
  background: '#0b0d12',
  floor: '#10131a',
  floorGrid: '#EEE9DF',
  wall: '#0e1016',
  trim: '#1c2029',
  metal: '#242833',
  glass: '#dfe8f2',
  // Ivory: every line, glyph and piece of interaction feedback.
  ivory: '#EEE9DF',
  ivoryDim: '#a9a69e',
  ivoryFaint: '#6d6c68',
  ink: '#0b0d12',
  // Zone accents. The factual field and the verification instrument are
  // neutral ivory: only the hypothetical (violet) and the intervention
  // (copper) are tinted, and both come from the ENGRAM mark.
  evidence: '#EEE9DF',
  provenance: '#EEE9DF',
  containment: '#D58B58',
  chamber: '#B8A6EC',
  vault: '#4be0a0',
  // Interaction feedback (never a status): ivory, like the structure.
  hover: '#EEE9DF',
  selected: '#EEE9DF',
  // Preview / staged (never a committed status).
  staged: '#e0a62b',
} as const;

/** Seated lab origin: player sits at (0, 0, 0) facing -Z. */
export const OBSERVATORY = {
  benchCenter: { x: 0, y: 0, z: -0.35 },
  benchRadius: 1.15,
  benchSpanDeg: 120,
  /** Core origin; the foot's underside (0.12 below) rests on the arc top. */
  coreHeight: 0.98,
  actorRack: { x: 0, y: 1.52, z: -2.55, spread: 2.3 },
  chamber: { x: -2.35, y: 0, z: -1.45, radius: 0.8 },
  vault: { x: 2.35, y: 0, z: -1.45 },
  /** Intervention cradle: within seated arm's reach, right of the field,
   * clear of both the bench arc and the containment console. */
  cradle: { x: 1.10, y: 0.92, z: -0.30 },
} as const;

/**
 * Legibility floor for in-world text, in degrees of visual angle subtended
 * by the font's em height at the distance it is read from. Quest 3 resolves
 * roughly 25 pixels per degree, so 0.6 deg is ~15 px of em height: the
 * smallest size that stays readable without leaning in. Labels are sized
 * against this, not against a desktop screenshot.
 */
export const LEGIBILITY = {
  minEmDeg: 0.6,
  bodyEmDeg: 0.75,
  /** Seated eye height assumed for placement maths (local-floor). */
  seatedEye: 1.2,
} as const;
