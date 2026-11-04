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

test('R4-1. MNEME-down (503) is never rendered as connected; malicious content is escaped', async () => {
  const { diagnoseConnection, escapeHtml } = await import('../src/canvas/canvas-state.ts');
  const base = { reachable: true, httpStatus: null, protocolMatches: true, totalMemories: 8, healthStatus: 'ok' };
  assert.equal(diagnoseConnection({ ...base, httpStatus: 503 }).state, 'mneme-unavailable');
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml("a & 'b'"), 'a &amp; &#39;b&#39;');
});

test('R4-2. unattested derivations stay a distinct class; broken custody links are flagged', async () => {
  const { buildEdges: be, validateCustodyLinks } = await import('../src/canvas/canvas-state.ts');
  const e = be(impact({ derived_unattested: ['mem-omar-note'] }));
  assert.deepEqual(e.map((x) => x.cls), ['DERIVED_UNATTESTED']);
  const good = { memory_id: 'm', chain_length: 2, head_hash: 'h2', entries: [
    { memory_id: 'm', seq: 0, event_type: 'STORED', actor_id: 'a', reason: 'r', created_at: 't', payload_json: '{}', prev_hash: 'g', entry_hash: 'h1' },
    { memory_id: 'm', seq: 1, event_type: 'REINFORCED', actor_id: 'a', reason: 'r', created_at: 't', payload_json: '{}', prev_hash: 'h1', entry_hash: 'h2' }] };
  assert.equal(validateCustodyLinks(good), true);
  const bad = structuredClone(good); bad.entries[1].prev_hash = 'tampered';
  assert.equal(validateCustodyLinks(bad), false);
});

test('R4-3. expired sessions are flagged client-side; oversized edge sets stay typed', async () => {
  const { isSessionValid, buildEdges: be } = await import('../src/canvas/canvas-state.ts');
  assert.equal(isSessionValid(1000, 2000), false);
  assert.equal(isSessionValid(3000, 2000), true);
  const many = Array.from({ length: 5000 }, (_, i) => `m${i}`);
  assert.equal(be(impact({ possible_memories: many })).length, 5000);
});

test('R5-1. whole-graph edges keep MNEME kind/direction; only CO_SERVED is symmetric', async () => {
  const { typedGraphEdges } = await import('../src/canvas/canvas-state.ts');
  const ids = new Set(['a', 'b', 'c']);
  const reports = [{ edges: [
    { level: 'POSSIBLE', kind: 'CO_SERVED', source: 'a', target: 'b' },
    { level: 'POSSIBLE', kind: 'CO_SERVED', source: 'b', target: 'a' },
    { level: 'DERIVED', kind: 'SUPERSEDED_BY', source: 'a', target: 'c' },
    { level: 'DIRECT', kind: 'USED_BY', source: 'a', target: 'decision-1' },
  ] }];
  const edges = typedGraphEdges(reports, ids);
  assert.equal(edges.length, 2);
  assert.equal(edges.find((e) => e.kind === 'CO_SERVED')?.directed, false);
  assert.equal(edges.find((e) => e.kind === 'SUPERSEDED_BY')?.directed, true);
});

test('R5-2. graph layout is deterministic and focus neighbours get exposure language, never contamination', async () => {
  const { computeGraphLayout, focusNeighborhood } = await import('../src/canvas/canvas-state.ts');
  const ids = ['a', 'b', 'c', 'd'];
  const edges = [{ source: 'a', target: 'b', cls: 'POSSIBLE', kind: 'CO_SERVED', directed: false, label: 'x' }];
  const l1 = computeGraphLayout(ids, edges, 'a');
  assert.deepEqual(l1, computeGraphLayout(ids, edges, 'a'));
  const pts = Object.values(l1);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
    assert.ok(Math.abs(pts[i].x - pts[j].x) > 100 || Math.abs(pts[i].y - pts[j].y) > 100, 'nodes overlap');
  assert.match(focusNeighborhood(edges, 'a').exposure.get('b'), /effect not determined/);
});

test('R5-3. comparison classification separates both/only-baseline/only-hypothetical', async () => {
  const { classifyComparison } = await import('../src/canvas/canvas-state.ts');
  const c = classifyComparison(delta({ served_a: ['a', 'b'], served_b: ['b', 'c'], rank_changed: [['b', 1, 2]] }));
  assert.deepEqual(c, { inBoth: ['b'], onlyBaseline: ['a'], onlyHypothetical: ['c'], rankChanged: ['b'] });
});

test('guided demo target is chosen from server custody status, never hardcoded as fact', () => {
  assert.equal(findCompromised([mem('a'), mem('b', 'TAINT_FLAGGED')])?.memory_id, 'b');
  assert.equal(findCompromised([mem('a')]), null);
});
