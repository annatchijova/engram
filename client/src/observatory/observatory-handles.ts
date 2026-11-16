/**
 * ENGRAM Memory Observatory — module-level registry for the static room
 * handles (chamber/vault glow materials and lights, the field limb) created
 * once in index.ts, so systems can light a zone when real work happens
 * there without owning the architecture themselves. Presentation only.
 */
import type { ObservatoryHandles } from './observatory-environment.js';

let handles: ObservatoryHandles | null = null;
let fieldPresence = 0;

export const ObservatoryScene = {
  set: (h: ObservatoryHandles): void => { handles = h; },
  get: (): ObservatoryHandles | null => handles,
  /**
   * How much of the recorded field is standing in the room, 0..1. Written
   * by FieldSystem from the real load (0 while nothing has been read or the
   * read failed, rising as memories arrive). The room's engraved limb is
   * lit by this and by nothing else, so an unlit instrument means "no field
   * was read", never a mood.
   */
  setFieldPresence: (v: number): void => { fieldPresence = Math.min(1, Math.max(0, v)); },
  getFieldPresence: (): number => fieldPresence,
};
