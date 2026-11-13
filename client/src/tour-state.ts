/**
 * ENGRAM — tiny pub/sub for the current tour stage, so GuideSystem and
 * FieldSystem can react to where the investigation is without importing
 * OnboardingSystem. Written only by OnboardingSystem.
 */
let current = 'WELCOME';
const listeners = new Set<(stage: string) => void>();

export const TourState = {
  get: (): string => current,
  set: (stage: string): void => {
    current = stage;
    for (const fn of listeners) fn(stage);
  },
  subscribe: (fn: (stage: string) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
