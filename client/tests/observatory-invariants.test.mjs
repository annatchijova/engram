/**
 * ENGRAM Memory Observatory — presentation invariants.
 *
 * These read the real source files as text (the XR modules import
 * @iwsdk/core, which needs a browser) and pin the rules the architecture
 * document puts on spatial meaning: which colors may carry evidence, which
 * may not, that the four causal edge classes stay distinguishable on more
 * than one channel, that the factual and hypothetical zones stay physically
 * apart, and that every in-world control a system wires actually exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');

const CUSTODY_HEX = ['#3fa34d', '#e0a62b', '#c13030', '#6b6f76'];

test('O1. custody_status keeps its exact declared palette in the XR field', () => {
  const field = read('src/field-system.ts');
  for (const hex of CUSTODY_HEX) assert.ok(field.includes(hex), `XR field missing ${hex}`);
  // The canvas surface renders the same four hexes: one vocabulary, two surfaces.
  const canvas = read('src/canvas/canvas-state.ts');
  for (const hex of CUSTODY_HEX) assert.ok(canvas.includes(hex), `canvas missing ${hex}`);
});

test('O2. transport, lineage and hypothetical colors are never custody colors', () => {
  const field = read('src/field-system.ts');
  const stateColor = /const STATE_COLOR = '([^']+)'/.exec(field)[1];
  assert.ok(!CUSTODY_HEX.includes(stateColor), 'LOADING/FAILED mark reuses a custody color');

  const lineage = /const LINEAGE_COLOR = '([^']+)'/.exec(read('src/custody-chain-system.ts'))[1];
  assert.ok(!CUSTODY_HEX.includes(lineage), 'supersession lineage reuses a custody color');

  const ghost = /const GHOST_COLOR = '([^']+)'/.exec(read('src/counterfactual-system.ts'))[1];
  assert.ok(!CUSTODY_HEX.includes(ghost), 'counterfactual ghost reuses a custody color');
});

test('O3. an actor status may only share a hex with custody when it means the same thing', () => {
  const actors = read('src/actor-system.ts');
  const active = /ACTIVE: '([^']+)'/.exec(actors)[1];
  const quarantined = /QUARANTINED: '([^']+)'/.exec(actors)[1];
  assert.ok(!CUSTODY_HEX.includes(active), 'ACTIVE actors must not borrow a custody color');
  // Deliberate and documented: a quarantined actor and a quarantined memory
  // are the same condition, so they are the same red.
  assert.equal(quarantined, '#c13030');
});

test('O4. the four causal edge classes differ on more than color alone', () => {
  const trace = read('src/trace-system.ts');
  const block = /const TRACE_STYLE[\s\S]*?\n};/.exec(trace)[0];
  const entries = [...block.matchAll(
    /(\w+): \{ color: '([^']+)', dashed: (true|false), opacity: ([\d.]+), pulse: (true|false), radius: ([\d.]+) \}/g,
  )].map((m) => ({
    cls: m[1], color: m[2], dashed: m[3] === 'true',
    opacity: Number(m[4]), pulse: m[5] === 'true', radius: Number(m[6]),
  }));
  assert.equal(entries.length, 4, 'expected exactly four edge classes');
  assert.equal(new Set(entries.map((e) => e.color)).size, 4, 'edge colors must be distinct');

  const byClass = Object.fromEntries(entries.map((e) => [e.cls, e]));
  const direct = byClass.DIRECT;
  const possible = byClass.POSSIBLE;
  // POSSIBLE is not causal: it must differ from DIRECT on colour AND form,
  // carry no travelling pulse, and never be the heaviest line in the room.
  assert.notEqual(possible.color, direct.color);
  assert.equal(possible.radius, 0, 'POSSIBLE must stay a hairline with no volume');
  assert.equal(possible.pulse, false, 'POSSIBLE must not animate like a causal edge');
  assert.ok(possible.opacity < direct.opacity);
  assert.ok(byClass.DERIVED.dashed && !direct.dashed, 'DERIVED and DIRECT must differ in form');
  assert.ok(byClass.DERIVED_UNATTESTED.radius < byClass.DERIVED.radius,
    'an unattested derivation must not look heavier than an attested one');
});

test('O5. factual, hypothetical and verification zones stay physically apart', () => {
  const palette = read('src/observatory/palette.ts');
  const num = (name, key) => {
    const block = new RegExp(`${name}: \\{([^}]*)\\}`).exec(palette)[1];
    return Number(new RegExp(`${key}: (-?[\\d.]+)`).exec(block)[1]);
  };
  const field = { x: num('benchCenter', 'x'), z: num('benchCenter', 'z') };
  const chamber = { x: num('chamber', 'x'), z: num('chamber', 'z') };
  const vault = { x: num('vault', 'x'), z: num('vault', 'z') };
  const benchRadius = Number(/benchRadius: ([\d.]+)/.exec(palette)[1]);
  const chamberRadius = num('chamber', 'radius');
  const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // The counterfactual chamber is a separate volume, not a recolour of the
  // field: its rim and the field's outer edge may never touch.
  assert.ok(gap(field, chamber) > benchRadius + chamberRadius,
    'the counterfactual chamber overlaps the factual field');
  assert.ok(gap(field, vault) > benchRadius, 'the verification instrument overlaps the factual field');
  assert.ok(chamber.x < 0 && vault.x > 0, 'hypothetical and verification zones must sit on opposite sides');
});

test('O6. every in-world control a system wires exists in a panel', () => {
  const uiDir = path.join(here, '..', 'public', 'ui');
  const ids = new Set();
  for (const file of fs.readdirSync(uiDir).filter((f) => f.endsWith('.uikitml'))) {
    for (const m of fs.readFileSync(path.join(uiDir, file), 'utf8').matchAll(/id="([^"]+)"/g)) {
      ids.add(m[1]);
    }
  }
  const srcDir = path.join(here, '..', 'src');
  const referenced = new Set();
  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'))) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
    // Panel lookups only: document.getElementById reaches the DOM host page.
    for (const m of code.matchAll(/(\w+)\??\.getElementById\(['`]([a-z0-9-]+)['`]\)/g)) {
      if (m[1] !== 'document') referenced.add(m[2]);
    }
    for (const m of code.matchAll(/requireElement\([^,]+,\s*'[^']+',\s*'([^']+)'\)/g)) referenced.add(m[1]);
    for (const m of code.matchAll(/\['([a-z-]+)', '([a-z-]+)', '([a-z-]+)'\]\s*\n\s*\.map\(\(id\) => requireElement/g)) {
      referenced.add(m[1]); referenced.add(m[2]); referenced.add(m[3]);
    }
  }
  assert.ok(referenced.size > 15, `expected to find the wired controls, found ${referenced.size}`);
  const missing = [...referenced].filter((id) => !ids.has(id) && !id.startsWith('swatch-') && !id.startsWith('text-'));
  assert.deepEqual(missing, [], `systems wire ids that no panel declares: ${missing.join(', ')}`);
});

test('O7. in-world buttons stay large enough to hit with a ray', () => {
  const uiDir = path.join(here, '..', 'public', 'ui');
  for (const file of fs.readdirSync(uiDir).filter((f) => f.endsWith('.uikitml'))) {
    const text = fs.readFileSync(path.join(uiDir, file), 'utf8');
    const classes = [...text.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)]
      .map((m) => ({ name: m[1], body: m[2] }));
    const buttonClasses = new Set(
      [...text.matchAll(/<button class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    );
    for (const cls of classes.filter((c) => buttonClasses.has(c.name))) {
      const height = /height:\s*([\d.]+)/.exec(cls.body);
      assert.ok(height, `${file}: button class .${cls.name} declares no height`);
      // UIKit units are centimetres: a 2.4 cm target is the floor for a
      // comfortable seated ray press.
      assert.ok(Number(height[1]) >= 2.4,
        `${file}: .${cls.name} is ${height[1]}cm tall, under the 2.4cm ray target floor`);
    }
  }
});

test('O8. audio cues stay discreet and never replace on-screen information', () => {
  const audio = read('src/observatory/audio-cues.ts');
  const gains = [...audio.matchAll(/g: ([\d.]+) \}/g)].map((m) => Number(m[1]));
  assert.ok(gains.length >= 8, 'expected a cue table');
  for (const g of gains) assert.ok(g <= 0.06, `cue gain ${g} is too loud for an instrument cue`);
  assert.ok(/setEnabled/.test(audio), 'audio must be switchable off');
});
