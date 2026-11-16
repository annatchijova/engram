/**
 * ENGRAM Memory Observatory — art-direction invariants (Round 11).
 *
 * Like observatory-invariants.test.mjs, these read the real source files as
 * text (the XR modules import @iwsdk/core, which needs a browser). They pin
 * the rules the visual direction is built on, so a later change cannot
 * quietly turn design back into decoration:
 *   - hue is evidence, structure is neutral;
 *   - the field is still unless the system changed;
 *   - text is sized for a headset, not for a screenshot;
 *   - a panel field that is filled at runtime can actually render.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');
const uiDir = path.join(here, '..', 'public', 'ui');
const panels = fs.readdirSync(uiDir).filter((f) => f.endsWith('.uikitml'));

const CUSTODY_HEX = ['#3fa34d', '#e0a62b', '#c13030', '#6b6f76'];

test('A1. structure and interaction colours are never custody colours', () => {
  const palette = read('src/observatory/palette.ts');
  const token = (name) => new RegExp(`\\b${name}: '([^']+)'`).exec(palette)[1].toLowerCase();
  // `staged` is deliberately absent from this list: a staged preview says
  // "would be TAINT_FLAGGED" and borrows that status's amber on purpose.
  for (const name of ['evidence', 'provenance', 'containment', 'chamber', 'hover', 'selected', 'ivory', 'floorGrid']) {
    assert.ok(!CUSTODY_HEX.includes(token(name)), `OBS.${name} reuses a custody colour`);
  }
  // Interaction feedback is the same neutral as the architecture.
  assert.equal(token('hover'), token('ivory'));
  assert.equal(token('selected'), token('ivory'));
});

test('A2. the room architecture uses only neutral or mark-derived tints', () => {
  const env = read('src/observatory/observatory-environment.ts');
  for (const hex of CUSTODY_HEX) assert.ok(!env.includes(hex), `architecture hard-codes custody colour ${hex}`);
  // The verification zone is neutral at rest: the verdict colour belongs
  // to the bundle artifact, not to the pedestal.
  assert.ok(!/OBS\.vault/.test(env), 'the vault architecture must not wear the verdict colour');
});

test('A3. the field has no idle animation: motion is tied to events', () => {
  const field = read('src/field-system.ts');
  const ambience = read('src/ambience-system.ts');
  const env = read('src/observatory/observatory-environment.ts');
  for (const [name, src] of [['field-system', field], ['ambience-system', ambience], ['environment', env]]) {
    assert.ok(!/Math\.(sin|cos)\(\s*time/.test(src), `${name} animates on wall-clock time`);
  }
  // Selection and hover never change a plate's size.
  assert.ok(!/targetScale/.test(field), 'selection or hover must not scale a memory');
  // The room's limb is lit by the real field presence and nothing else.
  assert.match(field, /setFieldPresence\(/);
  assert.match(ambience, /getFieldPresence\(\)/);
});

test('A4. every memory is the same object: one shared geometry set', () => {
  const core = read('src/observatory/memory-core.ts');
  // Geometry is minted once at module scope, never per memory.
  const body = core.slice(core.indexOf('export function buildMemoryCore'));
  assert.ok(!/new (Box|Extrude|Shape|Octahedron|Torus|Cylinder)Geometry/.test(body),
    'buildMemoryCore must not create per-memory geometry');
});

test('A5. label typography has a legibility floor', () => {
  const labels = read('src/observatory/labels.ts');
  const pxPerM = Number(/export const PX_PER_M = (\d+)/.exec(labels)[1]);
  const minPx = Number(/export const MIN_PX = (\d+)/.exec(labels)[1]);
  // Smallest em height in metres, and the angle it subtends at 1.5 m (the
  // distance from the seated eye to the centre of the field arc).
  const emDeg = (Math.atan(minPx / pxPerM / 1.5) * 180) / Math.PI;
  assert.ok(emDeg >= 0.55, `smallest label em is ${emDeg.toFixed(2)} deg at 1.5 m`);
  assert.match(labels, /generateMipmaps = true/, 'labels must be mip-mapped against shimmer');
  // A caption that does not fit wraps; it is not silently cut.
  assert.match(labels, /function wrap\(/);
});

test('A6. panel text is sized for the distance it is read from', () => {
  const scene = JSON.parse(read('public/scenes/main.iwsdk.scene.json'));
  // Measured in the emulated Quest 3 runtime: one UIKit unit renders as
  // 0.77 cm at scale 1 (docs/XR-ART-DIRECTION-ROUND11.md, "Legibility").
  const UNIT_CM = 0.77;
  const eye = [0, 1.2, 0];
  for (const node of scene.nodes) {
    const file = `${node.content.asset.replace(/-panel$/, '')}.uikitml`;
    const text = fs.readFileSync(path.join(uiDir, file), 'utf8');
    const distance = Math.hypot(...node.transform.position.map((v, i) => v - eye[i]));
    const sizes = [...text.matchAll(/\.([\w-]+)\s*\{[^}]*?font-size:\s*([\d.]+)/g)]
      .map((m) => ({ cls: m[1], size: Number(m[2]) }));
    assert.ok(sizes.length > 0, `${file}: no font sizes found`);
    for (const { cls, size } of sizes) {
      const deg = (Math.atan((size * UNIT_CM * node.transform.scale) / 100 / distance) * 180) / Math.PI;
      // 0.40 deg is ~10 px of em height on a Quest 3: the floor for
      // secondary text. Primary reading text sits well above it.
      assert.ok(deg >= 0.4, `${file} .${cls}: ${deg.toFixed(2)} deg at ${distance.toFixed(2)} m`);
    }
  }
});

test('A7. a span that is filled at runtime starts with a text node', () => {
  // Root cause, verified in @drawcall/uikitml instantiate.js: a <span> is a
  // container, and its Text child is only created when the markup contains
  // a text node. An empty <span id="x"></span> therefore never renders
  // what setProperties({ text }) later gives it. Every id-bearing span must
  // carry a text node (a zero-width space is enough).
  for (const file of panels) {
    const text = fs.readFileSync(path.join(uiDir, file), 'utf8');
    const empty = [...text.matchAll(/<span[^>]*id="([^"]+)"[^>]*><\/span>/g)].map((m) => m[1]);
    assert.deepEqual(empty, [], `${file}: spans that can never show text: ${empty.join(', ')}`);
  }
});

test('A8. no physically-based glass on a mobile GPU', () => {
  const srcDir = path.join(here, '..', 'src');
  const files = [
    ...fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts')).map((f) => path.join(srcDir, f)),
    ...fs.readdirSync(path.join(srcDir, 'observatory')).map((f) => path.join(srcDir, 'observatory', f)),
  ];
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/MeshPhysicalMaterial/.test(code), `${path.basename(file)} uses MeshPhysicalMaterial`);
  }
});

test('A9. causal edges are arcs with one draw call each, and keep their classes apart', () => {
  const trace = read('src/trace-system.ts');
  assert.match(trace, /new InstancedMesh\(/, 'volumetric edges must be instanced');
  // The arc height rule must not depend on the edge class.
  const control = /this\.c\.y \+= ([^;]+);/.exec(trace)[1];
  assert.ok(!/cls|style|TRACE_STYLE/.test(control), 'arc height must be the same rule for every class');
  // POSSIBLE keeps its disclaimer on the edge itself.
  assert.match(trace, /NOT CAUSAL/);
});
