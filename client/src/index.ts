/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { ContainmentSystem } from './containment-system.js';
import { CounterfactualSystem } from './counterfactual-system.js';
import { FieldSystem } from './field-system.js';
import { initLoginOverlay } from './login-overlay.js';
import { PortableSystem } from './portable-system.js';
import { SelectionSystem } from './selection-system.js';
import { TraceSystem } from './trace-system.js';

initLoginOverlay();

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
  world.registerSystem(FieldSystem);
  world.registerSystem(SelectionSystem);
  world.registerSystem(ContainmentSystem);
  world.registerSystem(TraceSystem);
  world.registerSystem(CounterfactualSystem);
  world.registerSystem(PortableSystem);
}).catch((err) => showBootError('World.create failed', err));
