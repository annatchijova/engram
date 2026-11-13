/**
 * ENGRAM — which actor totem is currently sitting in the intervention
 * cradle, and therefore which actor a Stage preview describes.
 *
 * Docking is an intention, never an action: placing a totem in the cradle
 * only ever triggers the read-only preview endpoint. The architecture doc
 * forbids "soltar para ejecutar una mutación" — dropping something must
 * never commit — so Commit stays a separate, explicit, authorized click.
 */
let dockedActorId: string | null = null;
const listeners = new Set<(actorId: string | null) => void>();

export const InterventionStore = {
  get: (): string | null => dockedActorId,
  set: (actorId: string | null): void => {
    if (dockedActorId === actorId) return;
    dockedActorId = actorId;
    for (const fn of listeners) fn(dockedActorId);
  },
  subscribe: (fn: (actorId: string | null) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
