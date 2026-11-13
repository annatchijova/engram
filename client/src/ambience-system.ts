/**
 * ENGRAM — per-frame lab ambience (dust drift, bench strip breathing,
 * chamber/vault glow easing). Presentation only; no evidence meaning.
 */
import { createSystem } from '@iwsdk/core';
import { tickObservatory } from './observatory/observatory-environment.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';

export class AmbienceSystem extends createSystem({}) {
  update(delta: number, time: number): void {
    const h = ObservatoryScene.get();
    if (h) tickObservatory(h, delta, time);
  }
}
