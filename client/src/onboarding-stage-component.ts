/**
 * ENGRAM — Nivel 6 Guided First Contact.
 *
 * Monotonic stage of a first-time operator's progress through the real
 * Nivel 1-5 loop. Held on one non-visual singleton entity (OnboardingSystem
 * creates it) purely so it stays inspectable via ecs_find_entities during
 * development — nothing here is rendered directly from this component.
 */
import { createComponent, Types } from '@iwsdk/core';

export const OnboardingStageValue = {
  WELCOME: 'WELCOME',
  SELECT_DONE: 'SELECT_DONE',
  TRACE_DONE: 'TRACE_DONE',
  CONTAINMENT_DONE: 'CONTAINMENT_DONE',
  COUNTERFACTUAL_UNLOCKED: 'COUNTERFACTUAL_UNLOCKED',
  PORTABLE_UNLOCKED: 'PORTABLE_UNLOCKED',
  COMPLETE: 'COMPLETE',
} as const;

export const OnboardingStage = createComponent('OnboardingStage', {
  stage: {
    type: Types.Enum,
    default: OnboardingStageValue.WELCOME,
    enum: OnboardingStageValue,
  },
});
