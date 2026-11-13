/**
 * ENGRAM — tiny pub/sub for "the factual field was re-fetched" so systems
 * that project other real MNEME data (actors, staged previews) can resync
 * after a refresh. Fires only after a real, successful re-fetch.
 */
const listeners = new Set<() => void>();

export const FieldEvents = {
  emitRefreshed: (): void => { for (const fn of listeners) fn(); },
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
