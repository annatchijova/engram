/**
 * ENGRAM — Nivel 6 guided-tour stage machine.
 *
 * Pure stage logic with no IWSDK imports, so node --test can drive it
 * directly. OnboardingSystem owns the rendering; this module owns only
 * the question "given where the tour is and what the server just
 * confirmed, where does the tour move to, and what may be revealed".
 *
 * Stages advance monotonically: a stage is never un-reached. Events come
 * from onboarding-events.ts and fire only from real success paths.
 */
import type { OnboardingEvent } from './onboarding-events.js';

export const OnboardingStageValue = {
  WELCOME: 'WELCOME',
  SELECT_DONE: 'SELECT_DONE',
  TRACE_DONE: 'TRACE_DONE',
  PREVIEW_DONE: 'PREVIEW_DONE',
  CONTAINMENT_DONE: 'CONTAINMENT_DONE',
  COUNTERFACTUAL_UNLOCKED: 'COUNTERFACTUAL_UNLOCKED',
  PORTABLE_UNLOCKED: 'PORTABLE_UNLOCKED',
  COMPLETE: 'COMPLETE',
} as const;

export const STAGE_ORDER: readonly string[] = [
  OnboardingStageValue.WELCOME,
  OnboardingStageValue.SELECT_DONE,
  OnboardingStageValue.TRACE_DONE,
  OnboardingStageValue.PREVIEW_DONE,
  OnboardingStageValue.CONTAINMENT_DONE,
  OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  OnboardingStageValue.PORTABLE_UNLOCKED,
  OnboardingStageValue.COMPLETE,
];

// Event -> the stage it proves was reached. The Counterfactual Chamber
// is read-only investigation, so a staged containment preview
// ('stage-done') is enough to reveal it: the guided tour must never push
// the operator into a real mutation just to compare worlds. Only the
// 'Contained it' checklist milestone requires the actual commit
// ('commit-done'); staging a preview never claims containment happened.
export const EVENT_STAGE: Partial<Record<OnboardingEvent, string>> = {
  'detail-shown': OnboardingStageValue.SELECT_DONE,
  'trace-run': OnboardingStageValue.TRACE_DONE,
  'stage-done': OnboardingStageValue.PREVIEW_DONE,
  'commit-done': OnboardingStageValue.CONTAINMENT_DONE,
  'exclusion-run': OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  'containment-cf-run': OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  'bundle-verified': OnboardingStageValue.COMPLETE,
};

/** Monotonic advance: returns `current` unchanged when the event proves
 * nothing new or would move the tour backwards. */
export function advanceStage(current: string, event: OnboardingEvent): string {
  const target = EVENT_STAGE[event];
  if (!target) return current;
  return STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(current) ? target : current;
}

export function stageAtLeast(stage: string, threshold: string): boolean {
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(threshold);
}

/** Whether the Counterfactual Chamber may be revealed at this stage.
 * Revealed once a containment preview has been staged (PREVIEW_DONE);
 * a real commit is not required to investigate a sealed hypothetical. */
export function counterfactualRevealed(stage: string): boolean {
  return stageAtLeast(stage, OnboardingStageValue.PREVIEW_DONE);
}
