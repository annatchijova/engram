/**
 * ENGRAM Canvas — adversarial invariant tests (node --test, no new deps).
 * Pure-logic level: each test states its falsifier. Run: npm test (in client/).
 * Runtime/DOM behaviour is NOT covered here and is reported as such in docs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyDrag, buildEdges, buildJsonCanvas, canCommit, custodyPresentation,
  custodySummary, findCompromised, onCounterfactualError,
  partitionCounterfactual, serializeLayout, wideningGuard,
} from '../src/canvas/canvas-state.ts';

const mem = (id, status = 'CLEAN') => ({
  memory_id: id, topic: 'deploy-policy', field_state: 'NEUTRAL',
  custody_status: status, created_at: '2026-01-01T00:00:00Z', content_preview: `preview ${id}`,
});
const impact = (over = {}) => ({
  memory_id: 'mem-a', direct_receipts: [], direct_decisions: [],
  derived_memories: [], derived_unattested: [], derived_decisions: [],
  possible_memories: [], impact_sha256: 'abc', ...over,
});
const delta = (over = {}) => ({
  query_sha256: 'q', top_k: 5, hops: 2, world_a_override: [], world_b_override: [],
  served_a: ['mem-a'], served_b: ['mem-b'], receipt_a_sha256: 'ra', receipt_b_sha256: 'rb',
  removed_from_serving: ['mem-a'], entered_top_k: ['mem-b'], rank_changed: [],
  score_changed: [], claim_outcome_changed: [], decision_dependency_changed: [],
  interference: true, summary: 's', delta_sha256: 'd', ...over,
});

test('1. dragging a quarantined card into a "verified" group changes layout only, never custody', () => {
  const m = mem('mem-q', 'QUARANTINED');
  const next = applyDrag({}, m.memory_id, 900, 40);
  assert.equal(m.custody_status, 'QUARANTINED');
  assert.deepEqual(next['mem-q'], { x: 900, y: 40 });
});

test('2. hypothetical serving list is never merged into the factual set', () => {
  const p = partitionCounterfactual(delta());
  assert.deepEqual(p.factual, ['mem-a']);
  assert.deepEqual(p.hypothetical, ['mem-b']);
  assert.ok(!p.factual.includes('mem-b'), 'entered hypothetical leaked into factual');
});

test('3. two relationship types may share the same endpoints', () => {
  const edges = buildEdges(impact({ derived_memories: ['mem-b'], possible_memories: ['mem-b'] }));
  assert.equal(edges.length, 2);
  assert.deepEqual(edges.map((e) => e.cls).sort(), ['DERIVED', 'POSSIBLE']);
});

test('4. stale snapshot refuses commit; matching version allows the attempt (MNEME still decides)', () => {
  assert.equal(canCommit(7, 9).ok, false);
  assert.match(canCommit(7, 9).reason, /Stale snapshot/);
  assert.equal(canCommit(9, 9).ok, true);
  assert.equal(canCommit(null, 9).ok, false);
});

test('5. widening counterfactual without a session is refused client-side; MNEME gate still applies', () => {
  assert.equal(wideningGuard(null).ok, false);
  assert.equal(wideningGuard('tok').ok, true);
});

test('6. incomplete custody reads as unknown, never as clean', () => {
  assert.match(custodySummary(null), /unknown/);
  assert.match(custodySummary({ memory_id: 'x', chain_length: 0, head_hash: '', entries: [] }), /unknown/);
  assert.equal(custodyPresentation('SOME_FUTURE_STATUS').glyph, '?');
  assert.notEqual(custodyPresentation('SOME_FUTURE_STATUS').label, 'Clean');
});

test('7. network failure mid-comparison discards the hypothetical and keeps factual state', () => {
  const state = { hypothetical: partitionCounterfactual(delta()), factualCards: ['mem-a'] };
  const next = onCounterfactualError(state);
  assert.equal(next.hypothetical, null);
  assert.deepEqual(next.factualCards, ['mem-a']);
});

test('8. custody presentation matches XR palette hexes (single meaning across surfaces)', () => {
  assert.equal(custodyPresentation('CLEAN').hex, '#3fa34d');
  assert.equal(custodyPresentation('TAINT_FLAGGED').hex, '#e0a62b');
  assert.equal(custodyPresentation('QUARANTINED').hex, '#c13030');
  assert.equal(custodyPresentation('SUPERSEDED').hex, '#6b6f76');
});

test('9. JSON Canvas export declares exactly what semantics it loses', () => {
  const out = buildJsonCanvas([mem('mem-a')], {}, buildEdges(impact({ possible_memories: ['mem-b'] })));
  const parsed = JSON.parse(out.json);
  assert.match(parsed.edges[0].label, /POSSIBLE/);
  assert.ok(out.warnings.some((w) => /NOT exported/.test(w)));
  assert.ok(out.warnings.some((w) => /generic/.test(w)));
});

test('10. POSSIBLE label says NOT causal regardless of card distance', () => {
  const near = buildEdges(impact({ possible_memories: ['mem-b'] }))[0];
  assert.match(near.label, /NOT causal/);
  const layout = { 'mem-a': { x: 0, y: 0 }, 'mem-b': { x: 9999, y: 9999 } };
  assert.equal(serializeLayout(layout), serializeLayout({ 'mem-b': { x: 9999, y: 9999 }, 'mem-a': { x: 0, y: 0 } }));
});

test('R3-1. connection states are distinguishable and never swap empty for down', async () => {
  const { diagnoseConnection } = await import('../src/canvas/canvas-state.ts');
  const base = { reachable: true, httpStatus: null, protocolMatches: true, totalMemories: 8, healthStatus: 'ok' };
  assert.equal(diagnoseConnection({ ...base, reachable: false }).state, 'server-unavailable');
  assert.equal(diagnoseConnection({ ...base, httpStatus: 401 }).state, 'auth-required');
  assert.equal(diagnoseConnection({ ...base, protocolMatches: false }).state, 'schema-mismatch');
  assert.equal(diagnoseConnection({ ...base, totalMemories: 0 }).state, 'empty-investigation');
  assert.equal(diagnoseConnection(base).state, 'connected');
});

test('R3-2. viewport zoom is clamped and fit derives from bounds only', async () => {
  const { clampZoom, fitScale } = await import('../src/canvas/canvas-state.ts');
  assert.equal(clampZoom(99), 2);
  assert.equal(clampZoom(0.01), 0.4);
  assert.equal(fitScale({ w: 800, h: 600 }, { w: 400, h: 600 }), 0.5);
  assert.equal(fitScale({ w: 0, h: 0 }, { w: 400, h: 600 }), 1);
});

test('R3-3. Canvas custody palette matches the XR field-system source (projection consistency)', async () => {
  const fs = await import('node:fs');
  const xr = fs.readFileSync(new URL('../src/field-system.ts', import.meta.url), 'utf8');
  for (const hex of ['#3fa34d', '#e0a62b', '#c13030', '#6b6f76']) assert.ok(xr.includes(hex), `XR missing ${hex}`);
  const cfg = JSON.parse(fs.readFileSync(new URL('../iwsdk.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.world.xr.features.handTracking, true);
  assert.equal(cfg.world.features.locomotion, false);
});

test('guided demo target is chosen from server custody status, never hardcoded as fact', () => {
  assert.equal(findCompromised([mem('a'), mem('b', 'TAINT_FLAGGED')])?.memory_id, 'b');
  assert.equal(findCompromised([mem('a')]), null);
});
