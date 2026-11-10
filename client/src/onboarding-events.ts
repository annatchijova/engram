/**
 * ENGRAM — tiny pub/sub store for real, server-confirmed milestones that
 * drive Nivel 6 gating. Mirrors selected-memory.ts's pattern: emitters only
 * fire from an existing success path (never on click/intent alone), so
 * OnboardingSystem can never advance ahead of what the server actually
 * confirmed. Every other system imports only this leaf module, never
 * onboarding-system.ts itself — deleting Nivel 6 means removing one system
 * registration plus these emit call sites, nothing else changes.
 */

export type OnboardingEvent =
  | 'detail-shown'
  | 'trace-run'
  | 'stage-done'
  | 'commit-done'
  | 'exclusion-run'
  | 'containment-cf-run'
  | 'bundle-verified';

const listeners = new Set<(event: OnboardingEvent) => void>();

export const OnboardingEvents = {
  emit: (event: OnboardingEvent): void => {
    for (const fn of listeners) fn(event);
  },
  subscribe: (fn: (event: OnboardingEvent) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
