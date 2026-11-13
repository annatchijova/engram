/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { ActorSystem } from './actor-system.js';
import { ContainmentSystem } from './containment-system.js';
import { CounterfactualSystem } from './counterfactual-system.js';
import { CustodyChainSystem } from './custody-chain-system.js';
import { FieldSystem } from './field-system.js';
import { HoverPreviewSystem } from './hover-preview-system.js';
import { buildObservatory } from './observatory/observatory-environment.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';
import { AmbienceSystem } from './ambience-system.js';
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
  // The Memory Lab room: benches, consoles, chamber, vault, lights, dust.
  // Pure presentation — no evidence meaning rides on any of it; the
  // systems below place real MNEME data into its zones.
  ObservatoryScene.set(buildObservatory(world.scene));

  world.registerSystem(FieldSystem);
  world.registerSystem(ActorSystem);
  world.registerSystem(LoginSystem);
  world.registerSystem(HoverPreviewSystem);
  world.registerSystem(SelectionSystem);
  world.registerSystem(CustodyChainSystem);
  world.registerSystem(ContainmentSystem);
  world.registerSystem(TraceSystem);
  world.registerSystem(CounterfactualSystem);
  world.registerSystem(PortableSystem);
  world.registerSystem(AmbienceSystem);
  // Last: it reaches into panels (containment/counterfactual/portable,
  // legend's trace section) that the systems above already resolved via
  // getSceneObject in their own init() — registration order is the only
  // thing guaranteeing those lookups succeed here.
  world.registerSystem(OnboardingSystem);
}).catch((err) => showBootError('World.create failed', err));
