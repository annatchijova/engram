/**
 * ENGRAM — in-memory client session.
 *
 * Deliberately NOT persisted to localStorage: this holds a session token,
 * not a long-lived credential, and Nivel 1 viewing never requires it — the
 * 3D scene boots with the read-only token regardless of login state. Lost
 * on refresh by design; log in again.
 */

export type Session = {
  sessionToken: string;
  actorId: string;
  displayName: string;
  effectiveCapabilities: string[];
};

let current: Session | null = null;
const listeners = new Set<(session: Session | null) => void>();

export const SessionStore = {
  get: (): Session | null => current,
  set: (session: Session | null): void => {
    current = session;
    for (const fn of listeners) fn(current);
  },
  subscribe: (fn: (session: Session | null) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
