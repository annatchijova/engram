/**
 * ENGRAM — Nivel 6 Guided First Contact.
 *
 * Monotonic stage of a first-time operator's progress through the real
 * Nivel 1-5 loop. Held on one non-visual singleton entity (OnboardingSystem
 * creates it) purely so it stays inspectable via ecs_find_entities during
 * development — nothing here is rendered directly from this component.
 */
import { createComponent, Types } from '@iwsdk/core';
import { OnboardingStageValue } from './onboarding-stage-machine.js';

export { OnboardingStageValue };

export const OnboardingStage = createComponent('OnboardingStage', {
  stage: {
    type: Types.Enum,
    default: OnboardingStageValue.WELCOME,
    enum: OnboardingStageValue,
  },
});
