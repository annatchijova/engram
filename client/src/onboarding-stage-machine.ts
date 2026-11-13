/**
 * ENGRAM — Guided First Contact: the stage machine.
 *
 * Pure stage logic with no IWSDK imports, so node --test can drive it
 * directly. OnboardingSystem owns the rendering; this module owns only
 * the question "given where the investigation is and what the server
 * just confirmed, where does it move to, and what may be revealed".
 *
 * The tour is a sequence of questions, each answered by one real
 * operation whose success path emits an OnboardingEvent. Events advance
 * stages monotonically: a stage is never un-reached by an event. The two
 * non-event transitions are explicit operator choices — "Explore freely"
 * jumps to COMPLETE, "Restart the investigation" returns to DISCOVER —
 * and exist only as functions a button calls, never as a timer.
 *
 * Nothing in the tour requires a mutation: a staged containment preview
 * (read-only) is the intervention step, and a commit only ticks a
 * milestone, it does not gate progress.
 */
import type { OnboardingEvent } from './onboarding-events.js';

export const OnboardingStageValue = {
  /** Welcome card shown; the room is visible behind it, nothing else. */
  WELCOME: 'WELCOME',
  /** Q1: which memory deserves attention? Answered by selecting it. */
  DISCOVER: 'DISCOVER',
  /** Q2: where did it come from? Answered by the custody record on screen. */
  ORIGIN: 'ORIGIN',
  /** Q3: what depended on it? Answered by Trace impact. */
  CONSEQUENCES: 'CONSEQUENCES',
  /** Q4: what changes without it? Answered by a counterfactual comparison. */
  ALTERNATIVES: 'ALTERNATIVES',
  /** Q5: what would an intervention do, and who may do it? Answered by a staged preview. */
  INTERVENTION: 'INTERVENTION',
  /** Q6 answered: the bundle was exported and independently verified. */
  COMPLETE: 'COMPLETE',
} as const;

export type OnboardingStage = (typeof OnboardingStageValue)[keyof typeof OnboardingStageValue];

export const STAGE_ORDER: readonly string[] = [
  OnboardingStageValue.WELCOME,
  OnboardingStageValue.DISCOVER,
  OnboardingStageValue.ORIGIN,
  OnboardingStageValue.CONSEQUENCES,
  OnboardingStageValue.ALTERNATIVES,
  OnboardingStageValue.INTERVENTION,
  OnboardingStageValue.COMPLETE,
];

// Event -> the stage it proves was reached. Every event fires only from
// an existing server-confirmed success path (see onboarding-events.ts).
// 'commit-done' is deliberately absent: a real quarantine is never a tour
// requirement, it only ticks the "contained" milestone below.
export const EVENT_STAGE: Partial<Record<OnboardingEvent, string>> = {
  'detail-shown': OnboardingStageValue.ORIGIN,
  'trace-run': OnboardingStageValue.CONSEQUENCES,
  'exclusion-run': OnboardingStageValue.ALTERNATIVES,
  'containment-cf-run': OnboardingStageValue.ALTERNATIVES,
  'stage-done': OnboardingStageValue.INTERVENTION,
  'bundle-verified': OnboardingStageValue.COMPLETE,
};

/** Monotonic advance: returns `current` unchanged when the event proves
 * nothing new or would move the tour backwards. An event never leaves
 * WELCOME: the operator chooses Begin or Explore first. */
export function advanceStage(current: string, event: OnboardingEvent): string {
  if (current === OnboardingStageValue.WELCOME) return current;
  const target = EVENT_STAGE[event];
  if (!target) return current;
  return STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(current) ? target : current;
}

/** "Begin investigation": the welcome card gives way to the first question. */
export function beginTour(current: string): string {
  return current === OnboardingStageValue.WELCOME ? OnboardingStageValue.DISCOVER : current;
}

/** "Explore freely": every zone and panel, no questions. */
export function exploreFreely(): string {
  return OnboardingStageValue.COMPLETE;
}

/** "Restart the investigation": the one backwards transition, and only
 * because the operator asked for it. Nothing in MNEME is touched. */
export function restartTour(): string {
  return OnboardingStageValue.DISCOVER;
}

export function stageAtLeast(stage: string, threshold: string): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(threshold);
}

/** Which surfaces are revealed at a stage. Revealed means "may be used";
 * the inspector and the authority card additionally open only when the
 * operator selects something, which their own systems handle. */
export type Reveal = {
  welcome: boolean;
  guide: boolean;
  legend: boolean;
  traceLegend: boolean;
  counterfactual: boolean;
  containment: boolean;
  login: boolean;
  portable: boolean;
};

export function revealedAt(stage: string): Reveal {
  const at = (t: string) => stageAtLeast(stage, t);
  return {
    welcome: stage === OnboardingStageValue.WELCOME,
    guide: stage !== OnboardingStageValue.WELCOME,
    legend: at(OnboardingStageValue.DISCOVER),
    traceLegend: at(OnboardingStageValue.CONSEQUENCES),
    counterfactual: at(OnboardingStageValue.CONSEQUENCES),
    containment: at(OnboardingStageValue.ALTERNATIVES),
    login: at(OnboardingStageValue.ALTERNATIVES),
    portable: at(OnboardingStageValue.INTERVENTION),
  };
}

/** Kept for callers and tests from earlier rounds. */
export function counterfactualRevealed(stage: string): boolean {
  return revealedAt(stage).counterfactual;
}
