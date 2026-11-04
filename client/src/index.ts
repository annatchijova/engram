/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  GridHelper,
  PointLight,
  World,
} from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { ContainmentSystem } from './containment-system.js';
import { CounterfactualSystem } from './counterfactual-system.js';
import { FieldSystem } from './field-system.js';
import { HoverPreviewSystem } from './hover-preview-system.js';
import { LoginSystem } from './login-system.js';
import { OnboardingSystem } from './onboarding-system.js';
import { PortableSystem } from './portable-system.js';
import { SelectionSystem } from './selection-system.js';
import { TraceSystem } from './trace-system.js';

// Deployment diagnostics: World.create() previously had no .catch(), and a
// rejection or a worker-thread error can be invisible to normal console
// tooling. Surface everything to a visible DOM element too, not just
// console, so a failure is never silently a black screen.
function showBootError(label: string, detail: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[ENGRAM boot] ${label}:`, detail);
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:16px;left:16px;z-index:20;max-width:480px;' +
    'background:#2a0e0e;border:1px solid #a53a3a;border-radius:8px;' +
    'padding:12px 14px;color:#ffd8d8;font:12px monospace;white-space:pre-wrap;';
  el.textContent = `[ENGRAM boot] ${label}: ${String((detail as Error)?.stack ?? detail)}`;
  document.body.appendChild(el);
}

window.addEventListener('error', (e) => showBootError('uncaught error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showBootError('unhandled rejection', e.reason));

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // Investigation room atmosphere: deep graphite-blue, restrained fog for
  // depth. Pure presentation — no evidence meaning rides on it.
  const scene = (world as { scene?: { background: unknown; fog: unknown } }).scene;
  if (scene) {
    scene.background = new Color('#101722');
    scene.fog = new FogExp2('#101722', 0.045);
    const rig = scene as unknown as { add: (...o: unknown[]) => void };
    rig.add(new AmbientLight('#8fa8bf', 0.7));
    const key = new DirectionalLight('#dfeaf5', 1.6);
    key.position.set(1.5, 3, 1.5);
    rig.add(key);
    // Atmosphere pass: still presentation-only, still no evidence meaning.
    // A cool rim light behind the arc separates the slabs from the
    // near-black background instead of leaving them flat-lit; a dim grid
    // floor gives the seated room a spatial anchor in the empty lower
    // field instead of the player standing over a void.
    const rim = new PointLight('#2e6a8f', 2.2, 6, 2);
    rim.position.set(0, 0.9, -2.3);
    rig.add(rim);
    const floor = new GridHelper(6, 24, '#2a3340', '#1a212b');
    floor.position.set(0, 0, -1.6);
    rig.add(floor);
  }
  world.registerSystem(FieldSystem);
  world.registerSystem(LoginSystem);
  world.registerSystem(HoverPreviewSystem);
  world.registerSystem(SelectionSystem);
  world.registerSystem(ContainmentSystem);
  world.registerSystem(TraceSystem);
  world.registerSystem(CounterfactualSystem);
  world.registerSystem(PortableSystem);
  // Last: it reaches into panels (containment/counterfactual/portable,
  // legend's trace section) that the systems above already resolved via
  // getSceneObject in their own init() — registration order is the only
  // thing guaranteeing those lookups succeed here.
  world.registerSystem(OnboardingSystem);
}).catch((err) => showBootError('World.create failed', err));
