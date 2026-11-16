/**
 * ENGRAM — per-frame room state. The only thing that moves here is the
 * engraved limb easing toward the real field presence FieldSystem reports.
 * There is no idle animation: the room is still unless the system changed.
 */
import { createSystem } from '@iwsdk/core';
import { tickObservatory } from './observatory/observatory-environment.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';

export class AmbienceSystem extends createSystem({}) {
  update(delta: number): void {
    const h = ObservatoryScene.get();
    if (h) tickObservatory(h, delta, ObservatoryScene.getFieldPresence());
  }
}
