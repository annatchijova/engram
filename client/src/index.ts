/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SpotLight,
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

    // Hemisphere fill replaces a flat AmbientLight: sky/ground tint gives
    // surfaces a soft top-down gradient instead of uniform flat light —
    // the single biggest source of the "flat" read on standard materials.
    rig.add(new HemisphereLight('#4f6b8c', '#1c2430', 0.65));

    const key = new DirectionalLight('#dfeaf5', 1.3);
    key.position.set(1.5, 3, 1.5);
    rig.add(key);
    // Soft cool fill opposite the key so the unlit side of every slab and
    // panel still reads as modeled geometry instead of falling to black —
    // low intensity on purpose, it must never compete with the key.
    const fill = new DirectionalLight('#5e7a99', 0.35);
    fill.position.set(-2, 1.6, 0.5);
    rig.add(fill);
    // A focused pool of light over the seated arc: the "interrogation
    // table" cue that makes the evidence band read as the room's one
    // deliberately lit surface instead of evenly floodlit geometry.
    const pool = new SpotLight('#eef3fa', 3.2, 7, Math.PI / 5, 0.55, 1.4);
    pool.position.set(0, 2.6, -0.6);
    pool.target.position.set(0, 1.1, -1.6);
    rig.add(pool);
    rig.add(pool.target);
    // Atmosphere pass: still presentation-only, still no evidence meaning.
    // A cool rim light behind the arc separates the slabs from the
    // near-black background instead of leaving them flat-lit.
    const rim = new PointLight('#2e6a8f', 2.2, 6, 2);
    rim.position.set(0, 0.9, -2.3);
    rig.add(rim);

    // Solid floor beneath the grid: without it the grid lines float in a
    // void with nothing to shade, which is the other half of "flat". A
    // slightly glossy dark surface catches the key/pool lights and gives
    // the seated room an actual ground plane instead of empty space below
    // the player.
    const floorMat = new MeshStandardMaterial({
      color: new Color('#0c1118'),
      roughness: 0.78,
      metalness: 0.12,
    });
    const floorMesh = new Mesh(new PlaneGeometry(7, 7), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.002, -1.6);
    rig.add(floorMesh);
    const floor = new GridHelper(6, 24, '#2a3340', '#1a212b');
    floor.position.set(0, 0, -1.6);
    rig.add(floor);

    // A back wall closes the room off instead of leaving the arc floating
    // against an unbroken void past the fog — a faint vertical gradient
    // (via the key/pool falloff) is now visible across its surface,
    // giving the space a back boundary the fog alone could never imply.
    const wallMat = new MeshStandardMaterial({
      color: new Color('#1b2534'),
      roughness: 0.82,
      metalness: 0.08,
      side: DoubleSide,
    });
    const wall = new Mesh(new PlaneGeometry(9, 4.5), wallMat);
    wall.position.set(0, 2.1, -3);
    rig.add(wall);
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
