/**
 * ENGRAM — Guided First Contact: the words and the pointers.
 *
 * One entry per stage: the question the investigator is answering, a
 * plain-language explanation, the one concrete action, and where in the
 * room that action happens (so GuideSystem can mark it). Every sentence
 * here was checked against MNEME's own definitions:
 *   - custody states: mneme/custody.py (M4: nothing is deleted;
 *     TAINT_FLAGGED is transitive from an actor quarantine; QUARANTINED
 *     is direct evidence against the memory; SUPERSEDED keeps history);
 *   - DIRECT / DERIVED / DERIVED_UNATTESTED / POSSIBLE: mneme/causality.py
 *     ("POSSIBLE is reported, never acted on, and never a custody status";
 *     an unattested derivation is "a third party claims descent from
 *     someone ELSE's decision ... strictly weaker");
 *   - compare_worlds: mneme/counterfactual.py ("neither world is
 *     privileged"; widening needs the COUNTERFACTUAL capability).
 * Nothing here asserts that a flagged memory is false: custody is about
 * provenance and trust, not truth.
 */
// Keyed by stage name as string literals on purpose: node --test loads this
// module through type-stripping, where a value import of the stage enum via
// a '.js' specifier would not resolve. The names are pinned by test T7.
const S = {
  DISCOVER: 'DISCOVER', ORIGIN: 'ORIGIN', CONSEQUENCES: 'CONSEQUENCES',
  ALTERNATIVES: 'ALTERNATIVES', INTERVENTION: 'INTERVENTION', COMPLETE: 'COMPLETE',
} as const;

export type GuideTarget =
  | { kind: 'core'; memoryId: string }
  | { kind: 'panel'; panelId: string }
  | { kind: 'zone'; zone: 'chamber' | 'vault' | 'cradle' }
  | { kind: 'none' };

export type TourStep = {
  index: number;
  question: string;
  body: string;
  action: string;
  target: GuideTarget;
};

export const TOUR_TOTAL = 5;

export const TOUR: Record<string, TourStep> = {
  [S.DISCOVER]: {
    index: 1,
    question: 'Which memory deserves our attention?',
    body:
      'Every capsule on the bench is a real memory MNEME holds, coloured by its custody state. ' +
      'One of them is marked: its source was quarantined after a decision had already used it. ' +
      'That does not make its content false. It makes it worth investigating.',
    action: 'Point at the marked memory and pinch (or click) to open it.',
    target: { kind: 'core', memoryId: 'mem-poison' },
  },
  [S.ORIGIN]: {
    index: 2,
    question: 'Where did this memory come from?',
    body:
      'The tower above it is its custody chain: every event recorded about it, in order, each linked to the previous by hash. ' +
      'Read it bottom-up. It was stored by pipeline-feeds, and that actor was later quarantined, which is why this memory is flagged. ' +
      'The full hashes stay available under "Show full record".',
    action: 'Press "Trace impact" on the inspector to your left.',
    target: { kind: 'panel', panelId: 'detail-panel' },
  },
  [S.CONSEQUENCES]: {
    index: 3,
    question: 'What depended on this information?',
    body:
      'The lines are MNEME\'s own impact report, not a guess. A solid bar is DIRECT: a recorded decision or recall receipt used it. ' +
      'Dashes are DERIVED: a memory declared it descends from that decision, by the same actor. ' +
      'Thin dashes are DERIVED but unattested: a different actor made the claim, so it is weaker and says so. ' +
      'A faint hairline is POSSIBLE: served alongside it, which is contact, not a cause.',
    action: 'Turn left to the violet column and press "Exclusion forecast".',
    target: { kind: 'panel', panelId: 'counterfactual-panel' },
  },
  [S.ALTERNATIVES]: {
    index: 4,
    question: 'What would change without it?',
    body:
      'The column holds a sealed comparison: the same query run against the recorded custody state (World A) and against a hypothetical one (World B). ' +
      'What each world served, and the delta between them, are exactly what MNEME returned. The hypothetical was never executed as reality and never merges into the field. ' +
      'Next: an intervention is prepared before anything is written.',
    action: 'Place the pipeline-logs totem in the amber cradle, or press "Stage quarantine" on the right console.',
    target: { kind: 'zone', zone: 'cradle' },
  },
  [S.INTERVENTION]: {
    index: 5,
    question: 'What would an intervention do, and who may do it?',
    body:
      'The amber rings show exactly which memories a quarantine of that actor would flag. Nothing has changed: this is a preview. ' +
      'Committing is a separate click that needs an operator session, and MNEME\'s authority gate decides, not this room. ' +
      'The last step keeps what you found in a form a third party can check.',
    action: 'Turn right to the green column and press "Export & Verify Bundle".',
    target: { kind: 'panel', panelId: 'portable-panel' },
  },
  [S.COMPLETE]: {
    index: 5,
    question: 'The investigation is preserved.',
    body:
      'The bundle in the vault was checked by a separate verifier process; the verdict shown is its own output. ' +
      'It confirms the exported record is complete and its hashes hold. It does not decide whether any memory\'s content is true. ' +
      'Everything here is still live: pick up a totem to read an actor\'s grants, or log in to commit for real.',
    action: 'Explore freely.',
    target: { kind: 'none' },
  },
};

/** Plain-language gloss per custody state, next to the technical name,
 * never instead of it. Sources: mneme/custody.py lines 316-323 and
 * server/app.py CUSTODY_STATUS_MEANING. */
export const CUSTODY_GLOSS: Record<string, string> = {
  CLEAN: 'servable to recall',
  TAINT_FLAGGED: 'its source actor was quarantined; needs investigation, can be rehabilitated',
  QUARANTINED: 'direct evidence against it; withheld from recall',
  SUPERSEDED: 'a newer version exists; this record is kept, not deleted',
};
