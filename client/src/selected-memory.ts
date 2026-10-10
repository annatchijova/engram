/**
 * ENGRAM — tiny pub/sub store for the currently-selected memory id.
 * Written by SelectionSystem, read by TraceSystem — mirrors session.ts's
 * pattern so neither system has to duplicate the other's ECS query.
 */

let current: string | null = null;
const listeners = new Set<(memoryId: string | null) => void>();

export const SelectedMemory = {
  get: (): string | null => current,
  set: (memoryId: string | null): void => {
    current = memoryId;
    for (const fn of listeners) fn(current);
  },
  subscribe: (fn: (memoryId: string | null) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
