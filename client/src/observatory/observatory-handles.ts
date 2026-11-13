/**
 * ENGRAM Memory Lab — module-level registry for the static lab handles
 * (chamber/vault glow materials and lights) created once in index.ts, so
 * systems can brighten a zone when real work happens there without owning
 * the architecture themselves. Presentation only.
 */
import type { ObservatoryHandles } from './observatory-environment.js';

let handles: ObservatoryHandles | null = null;

export const ObservatoryScene = {
  set: (h: ObservatoryHandles): void => { handles = h; },
  get: (): ObservatoryHandles | null => handles,
};
