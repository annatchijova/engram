/**
 * ENGRAM Canvas — 2D investigation surface over the same MNEME-backed
 * adapter as XR. Projection is not authority: this file only renders
 * EngramApi responses, stages the one supported mutation behind a
 * preview + explicit commit, and keeps hypothetical data in its own
 * panel. Layout (card x/y) lives in localStorage as presentation state.
 */
import { EngramApi, type CounterfactualDelta, type FieldOverview, type ImpactReport, type MemorySummary } from '../engram-api.js';
import { SelectedMemory } from '../selected-memory.js';
import { SessionStore } from '../session.js';
import {
  applyDrag, buildEdges, buildJsonCanvas, canCommit, custodyPresentation,
  custodySummary, diagnoseConnection, escapeHtml, findCompromised, fitScale, clampZoom, onCounterfactualError, partitionCounterfactual, validateCustodyLinks,
  serializeLayout, wideningGuard, type CanvasEdge, type CardLayout, type WorldPartition,
} from './canvas-state.js';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const LAYOUT_KEY = 'engram.canvas.layout.v1';
const EDGE_STROKE: Record<CanvasEdge['cls'], { stroke: string; dash: string; width: number }> = {
  DIRECT: { stroke: '#1f7fb8', dash: '', width: 3 },
  DERIVED: { stroke: '#9a6b12', dash: '8 5', width: 2 },
  DERIVED_UNATTESTED: { stroke: '#8a6a2a', dash: '3 5', width: 2 },
  POSSIBLE: { stroke: '#666666', dash: '1 5', width: 2 },
};

let overview: FieldOverview | null = null;
let memories: MemorySummary[] = [];
let layout: CardLayout = loadLayout();
let edges: CanvasEdge[] = [];
let lastImpact: ImpactReport | null = null;
let staged: { actorId: string; fieldVersion: number } | null = null;
let worldState: { hypothetical: WorldPartition | null } = { hypothetical: null };

function loadLayout(): CardLayout {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as CardLayout; } catch { return {}; }
}
function saveLayout(): void { localStorage.setItem(LAYOUT_KEY, serializeLayout(layout)); }
function pos(id: string, i: number): { x: number; y: number } {
  return layout[id] ?? { x: 24 + (i % 3) * 330, y: 24 + Math.floor(i / 3) * 230 };
}
function say(msg: string): void { $<HTMLElement>('status').textContent = msg; }
const esc = escapeHtml;

function renderCards(): void {
  const q = $<HTMLInputElement>('search').value.toLowerCase();
  const f = $<HTMLSelectElement>('filter-status').value;
  const box = $<HTMLElement>('cards');
  box.innerHTML = '';
  memories.forEach((m, i) => {
    if (f && m.custody_status !== f) return;
    if (q && !`${m.memory_id} ${m.topic ?? ''} ${m.content_preview}`.toLowerCase().includes(q)) return;
    const p = custodyPresentation(m.custody_status);
    const selected = SelectedMemory.get() === m.memory_id;
    const el = document.createElement('article');
    el.className = 'card' + (selected ? ' selected' : '');
    el.dataset.id = m.memory_id;
    el.style.left = `${pos(m.memory_id, i).x}px`;
    el.style.top = `${pos(m.memory_id, i).y}px`;
    el.style.borderTopColor = p.hex;
    el.innerHTML = `<h3>${esc(m.memory_id)}</h3>
      <span class="badge" style="border-color:${p.hex}">${p.glyph} ${esc(p.label)}</span>
      <p>${esc(m.content_preview || '(no preview returned)')}</p>
      <p class="mono">topic: ${esc(m.topic ?? 'not recorded')} · state: ${esc(m.field_state)}<br/>created: ${esc(m.created_at)}</p>
      <button type="button" class="inspect" aria-pressed="${selected}">Inspect ${esc(m.memory_id)}</button>
      <p class="hint">Arrow keys on this button move the card (layout only).</p>`;
    const btn = el.querySelector<HTMLButtonElement>('.inspect')!;
    btn.addEventListener('click', () => void selectMemory(m.memory_id));
    // Non-drag alternative for every drag (WCAG 2.5.7): arrows move, native button keeps focus semantics.
    btn.addEventListener('keydown', (ev) => {
      if (!ev.key.startsWith('Arrow')) return;
      ev.preventDefault();
      const step = ev.shiftKey ? 40 : 10;
      const cur = pos(m.memory_id, i);
      const dx = ev.key === 'ArrowRight' ? step : ev.key === 'ArrowLeft' ? -step : 0;
      const dy = ev.key === 'ArrowDown' ? step : ev.key === 'ArrowUp' ? -step : 0;
      layout = applyDrag(layout, m.memory_id, cur.x + dx, cur.y + dy); saveLayout(); renderCards(); drawEdges();
      document.querySelector<HTMLButtonElement>(`[data-id="${m.memory_id}"] .inspect`)?.focus();
    });
    enableDrag(el, m.memory_id, i);
    box.appendChild(el);
  });
  drawEdges();
}

function enableDrag(el: HTMLElement, id: string, i: number): void {
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest('button')) return;
    const start = pos(id, i);
    const sx = ev.clientX, sy = ev.clientY;
    const move = (e: PointerEvent): void => {
      layout = applyDrag(layout, id, start.x + e.clientX - sx, start.y + e.clientY - sy);
      el.style.left = `${layout[id]!.x}px`; el.style.top = `${layout[id]!.y}px`; drawEdges();
    };
    const up = (): void => {
      saveLayout();
      say('Card moved. Layout is presentation only — no MNEME state changed.');
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
}

function drawEdges(): void {
  const svg = document.getElementById('edges') as unknown as SVGSVGElement;
  svg.setAttribute('viewBox', '0 0 1600 1200');
  let html = '';
  for (const e of edges) {
    const si = memories.findIndex((m) => m.memory_id === e.source);
    const ti = memories.findIndex((m) => m.memory_id === e.target);
    if (si < 0 || ti < 0) continue;
    const a = pos(e.source, si), b = pos(e.target, ti);
    const s = EDGE_STROKE[e.cls];
    const mx = (a.x + b.x + 300) / 2, my = (a.y + b.y + 60) / 2;
    html += `<line x1="${a.x + 150}" y1="${a.y + 30}" x2="${b.x + 150}" y2="${b.y + 30}" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`
      + `<text x="${mx}" y="${my}" font-size="11" fill="#1b2129">${esc(e.cls)}</text>`;
  }
  svg.innerHTML = html;
}

async function selectMemory(id: string): Promise<void> {
  SelectedMemory.set(id);
  sessionStorage.setItem('engram.selectedMemory', id);
  history.replaceState(null, '', `?memory=${encodeURIComponent(id)}`);
  $<HTMLAnchorElement>('xr-link').href = `./index.html?memory=${encodeURIComponent(id)}`;
  renderCards();
  const body = $<HTMLElement>('insp-body');
  body.innerHTML = `<p>Loading ${esc(id)}…</p>`;
  try {
    const [detail, chain, impact] = await Promise.all([
      EngramApi.getMemory(id), EngramApi.getCustody(id), EngramApi.getImpact(id),
    ]);
    lastImpact = impact; edges = buildEdges(impact); drawEdges();
    const p = custodyPresentation(detail.custody_status);
    body.innerHTML = `
      <h3 class="mono">${esc(detail.memory_id)}</h3>
      <p><span class="badge" style="border-color:${p.hex}">${p.glyph} ${esc(p.label)}</span>
      <span class="hint">${esc(overview?.custody_status_meaning[detail.custody_status] ?? 'Meaning not returned by adapter — shown as unknown.')}</span></p>
      <p>${esc(detail.content)}</p>
      <table>
        <tr><th>Provenance</th><td>created by <span class="mono">${esc(detail.created_by)}</span> at ${esc(detail.created_at)}; topic ${esc(detail.topic ?? 'not recorded')}</td></tr>
        <tr><th>Content hash</th><td class="mono">${esc(detail.content_sha256)}</td></tr>
        <tr><th>Confidence (server text, never recomputed here)</th><td class="mono">${esc(detail.confidence)}</td></tr>
        <tr><th>Field state / superseded by</th><td>${esc(detail.field_state)} / ${esc(detail.superseded_by ?? '—')}</td></tr>
        <tr><th>Custody</th><td>${esc(custodySummary(chain))} Link structure: ${validateCustodyLinks(chain) ? 'consistent (display check only)' : 'BROKEN or unavailable — do not treat as verified; use the bundle verifier'}</td></tr>
        <tr><th>Impact seal</th><td class="mono">${esc(impact.impact_sha256)}</td></tr>
      </table>
      <h4>Relationships (typed, from MNEME impact)</h4>
      <ul>
        <li>DIRECT receipts: ${impact.direct_receipts.map(esc).join(', ') || 'none'}; decisions: ${impact.direct_decisions.map(esc).join(', ') || 'none'}</li>
        <li>DERIVED: ${impact.derived_memories.map(esc).join(', ') || 'none'}</li>
        <li>DERIVED (unattested): ${impact.derived_unattested.map(esc).join(', ') || 'none'}</li>
        <li>POSSIBLE (not causal): ${impact.possible_memories.map(esc).join(', ') || 'none'}</li>
        <li>DERIVED decisions: ${impact.derived_decisions.map(esc).join(', ') || 'none'}</li>
      </ul>
      <h4>Custody history</h4>
      ${chain.entries.map((e) => `<details><summary>#${e.seq} ${esc(e.event_type)} — ${esc(e.actor_id)} (${esc(e.created_at)})</summary>
        <p>${esc(e.reason)}</p><p class="mono">entry ${esc(e.entry_hash)}<br/>prev ${esc(e.prev_hash)}<br/>${esc(e.payload_json)}</p></details>`).join('') || '<p>No custody entries returned.</p>'}
      <p class="hint">Chain integrity for export is checked by the bundle verifier; this view displays the chain, it does not re-verify it.</p>`;
  } catch (err) {
    body.innerHTML = `<p role="alert">Could not inspect ${esc(id)}: ${esc((err as Error).message)}</p>`;
  }
}

async function boot(): Promise<void> {
  let healthStatus: string | null = null;
  try {
    healthStatus = (await EngramApi.health()).status;
  } catch {
    say(diagnoseConnection({ reachable: false, httpStatus: null, protocolMatches: null, totalMemories: null, healthStatus: null }).message);
    return;
  }
  try {
    const [ov, list, actors] = await Promise.all([
      EngramApi.overview(), EngramApi.listMemories(), EngramApi.listActors(),
    ]);
    overview = ov; memories = list.memories;
    $<HTMLElement>('custody-legend').innerHTML = Object.entries(ov.custody_status_meaning)
      .map(([s, meaning]) => { const p = custodyPresentation(s); return `<li><span class="badge" style="border-color:${p.hex}">${p.glyph} ${esc(p.label)}</span> ${esc(meaning)}</li>`; }).join('');
    $<HTMLSelectElement>('filter-status').innerHTML = '<option value="">All statuses</option>'
      + Object.keys(ov.custody_status_meaning).map((s) => `<option>${esc(s)}</option>`).join('');
    $<HTMLSelectElement>('actor-select').innerHTML = actors.actors
      .map((a) => `<option value="${esc(a.actor_id)}">${esc(a.display_name)} (${esc(a.actor_id)}, ${esc(a.status)})</option>`).join('');
    const diag = diagnoseConnection({ reachable: true, httpStatus: null, protocolMatches: true, totalMemories: ov.total_memories, healthStatus });
    say(`${diag.message} Field: ${ov.total_memories} memories, snapshot field_version ${ov.field_version}. Adapter state is authoritative; card positions are not.`);
    $<HTMLElement>('snapshot-line').textContent = `Snapshot: field_version ${ov.field_version} · health ${healthStatus ?? 'unknown'}`;
    $<HTMLElement>('inventory').innerHTML = memories.map((m) => `<li><button type="button" class="inv" data-inv="${esc(m.memory_id)}">${custodyPresentation(m.custody_status).glyph} <span class="mono">${esc(m.memory_id)}</span> — ${esc(custodyPresentation(m.custody_status).label)}</button></li>`).join('');
    document.querySelectorAll<HTMLButtonElement>('[data-inv]').forEach((b) => b.addEventListener('click', () => void selectMemory(b.dataset.inv!)));
    renderCards();
    const initial = new URLSearchParams(location.search).get('memory') ?? sessionStorage.getItem('engram.selectedMemory');
    if (initial && memories.some((m) => m.memory_id === initial)) await selectMemory(initial);
  } catch (err) {
    const status = /HTTP (\d{3})/.exec((err as Error).message)?.[1];
    say(diagnoseConnection({ reachable: true, httpStatus: status ? Number(status) : null, protocolMatches: null, totalMemories: null, healthStatus }).message + ` Detail: ${(err as Error).message}`);
  }
}

async function runCounterfactual(kind: 'exclusion' | 'containment'): Promise<void> {
  const aBox = $<HTMLElement>('world-a'), bBox = $<HTMLElement>('world-b'), dBox = $<HTMLElement>('cf-detail');
  try {
    let delta: CounterfactualDelta;
    if (kind === 'exclusion') {
      delta = await EngramApi.exclusionEffect();
    } else {
      const guard = wideningGuard(SessionStore.get()?.sessionToken ?? null);
      if (!guard.ok) { bBox.textContent = guard.reason; return; }
      delta = await EngramApi.containmentEffect(SessionStore.get()!.sessionToken);
    }
    const part = partitionCounterfactual(delta);
    worldState = { hypothetical: part };
    aBox.innerHTML = `<p>Served for the seeded query:</p><ul>${part.factual.map((id) => `<li class="mono">${esc(id)}</li>`).join('')}</ul><p class="mono">receipt ${esc(delta.receipt_a_sha256)}</p>`;
    bBox.innerHTML = `<p>Would be served under the override (never executed):</p><ul>${part.hypothetical.map((id) => `<li class="mono">${esc(id)}</li>`).join('')}</ul><p class="mono">receipt ${esc(delta.receipt_b_sha256)}</p>`;
    dBox.innerHTML = `
      <p><strong>MNEME summary (verbatim, beside its seal):</strong> ${esc(delta.summary)}</p>
      <p class="mono">delta_sha256 ${esc(delta.delta_sha256)} · query ${esc(delta.query_sha256)} · top_k ${delta.top_k} · hops ${delta.hops}</p>
      <p>Removed from serving: ${delta.removed_from_serving.map(esc).join(', ') || 'none'} · Entered: ${delta.entered_top_k.map(esc).join(', ') || 'none'} · Interference (query-scoped): <strong>${delta.interference ? 'yes' : 'no'}</strong></p>
      <p>Rank changes: ${delta.rank_changed.map((r) => `${esc(r[0])} ${r[1]}→${r[2]}`).join('; ') || 'none'} · Score changes: ${delta.score_changed.map((r) => `${esc(r[0])} ${esc(r[1])}→${esc(r[2])}`).join('; ') || 'none'}</p>
      <p>Claim outcome changes: ${delta.claim_outcome_changed.map((r) => `${esc(r[0])}: ${esc(r[1])}→${esc(r[2])}`).join('; ') || 'none reported'}</p>
      <p><strong>Decision dependencies changed (field-wide, kept separate from the query verdict):</strong> ${delta.decision_dependency_changed.map(esc).join(', ') || 'none'}</p>
      ${delta.read_audit ? `<p>Read audit: ${esc(delta.read_audit)}</p>` : ''}`;
  } catch (err) {
    worldState = onCounterfactualError(worldState);
    bBox.textContent = `Comparison failed: ${(err as Error).message} Any earlier hypothetical was discarded and must not be reused.`;
    dBox.innerHTML = '';
  }
}

function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

$<HTMLButtonElement>('preview-btn').addEventListener('click', () => void (async (): Promise<void> => {
  const actorId = $<HTMLSelectElement>('actor-select').value;
  const box = $<HTMLElement>('preview-body');
  try {
    const prev = await EngramApi.previewQuarantine(actorId);
    staged = { actorId, fieldVersion: prev.field_version };
    overview = overview ? { ...overview, field_version: prev.field_version } : overview;
    box.innerHTML = prev.already_quarantined
      ? `<p role="alert">Actor ${esc(actorId)} is already QUARANTINED. Nothing to stage.</p>`
      : `<p>Would flag <strong>${prev.count}</strong> memories at field_version ${prev.field_version}:</p><ul>${prev.would_flag_memory_ids.map((id) => `<li class="mono">${esc(id)}</li>`).join('')}</ul><p class="hint">Staged only. Nothing was committed.</p>`;
    $<HTMLButtonElement>('commit-btn').disabled = !SessionStore.get();
  } catch (err) { box.innerHTML = `<p role="alert">Preview failed: ${esc((err as Error).message)}</p>`; }
})());

$<HTMLButtonElement>('login-btn').addEventListener('click', () => void (async (): Promise<void> => {
  try {
    const r = await EngramApi.login($<HTMLInputElement>('login-user').value, $<HTMLInputElement>('login-pass').value);
    SessionStore.set({ sessionToken: r.session_token, actorId: r.actor_id, displayName: r.display_name, effectiveCapabilities: r.effective_capabilities, expiresAt: Date.now() + r.expires_in_seconds * 1000 });
    $<HTMLElement>('login-state').textContent = `Logged in as ${r.display_name} (${r.actor_id}). Capabilities from MNEME: ${r.effective_capabilities.join(', ') || 'none'}.`;
    $<HTMLButtonElement>('commit-btn').disabled = !staged;
  } catch (err) { $<HTMLElement>('login-state').textContent = `Login failed: ${(err as Error).message}`; }
})());

$<HTMLButtonElement>('commit-btn').addEventListener('click', () => void (async (): Promise<void> => {
  const box = $<HTMLElement>('commit-body');
  const session = SessionStore.get();
  if (!session || !staged) { box.innerHTML = '<p role="alert">Log in and run the preview first.</p>'; return; }
  const fresh = await EngramApi.overview().catch(() => null);
  const guard = canCommit(staged.fieldVersion, fresh?.field_version ?? null);
  if (!guard.ok) { box.innerHTML = `<p role="alert">${esc(guard.reason)}</p>`; return; }
  const reason = $<HTMLInputElement>('commit-reason').value.trim();
  if (!reason) { box.innerHTML = '<p role="alert">A reason is required by MNEME.</p>'; return; }
  if (!confirm(`Commit actor quarantine for ${staged.actorId}? This is the one mutating action and MNEME will check your authority.`)) return;
  try {
    const r = await EngramApi.commitQuarantine(staged.actorId, session.sessionToken, reason, `canvas-${Date.now()}`, staged.fieldVersion);
    box.innerHTML = `<p>Committed. Sweep <span class="mono">${esc(r.sweep_id)}</span> flagged ${r.flagged_count}: ${r.flagged_memory_ids.map(esc).join(', ') || 'none'}. Advisory resonant neighbours (not acted on): ${r.advisory_resonant_neighbours.map(esc).join(', ') || 'none'}.</p>`;
    staged = null; $<HTMLButtonElement>('commit-btn').disabled = true;
    await boot();
  } catch (err) { box.innerHTML = `<p role="alert">Commit refused: ${esc((err as Error).message)}</p>`; }
})());

$<HTMLButtonElement>('cf-exclusion').addEventListener('click', () => void runCounterfactual('exclusion'));
$<HTMLButtonElement>('cf-containment').addEventListener('click', () => void runCounterfactual('containment'));
$<HTMLInputElement>('search').addEventListener('input', renderCards);
$<HTMLSelectElement>('filter-status').addEventListener('change', renderCards);
$<HTMLButtonElement>('guide-btn').addEventListener('click', () => void (async (): Promise<void> => {
  const target = findCompromised(memories);
  if (!target) { say('No memory is marked TAINT_FLAGGED or QUARANTINED by the server in this field. Nothing was invented for the demo.'); return; }
  say(`Guided investigation: ${target.memory_id} is marked ${target.custody_status} by MNEME. Inspect it, preview containment, then compare worlds.`);
  await selectMemory(target.memory_id);
  document.querySelector(`[data-id="${target.memory_id}"]`)?.scrollIntoView({ block: 'center' });
})());
$<HTMLButtonElement>('json-btn').addEventListener('click', () => {
  const out = buildJsonCanvas(memories, layout, edges);
  download('engram-canvas.json', out.json);
  say(`JSON Canvas exported. Lost in export: ${out.warnings.join(' ')}`);
});
async function preserveBundle(): Promise<void> {
  try {
    const b = await EngramApi.exportBundle();
    const v = b.verifier;
    const label = v.status === 'VERIFIED' ? 'Bundle integrity VERIFIED by the independent verifier'
      : v.status === 'REJECTED' ? 'Bundle REJECTED by the verifier' : 'Verifier UNAVAILABLE — integrity unknown, not assumed';
    say(`${label} (${b.memory_count} memories, sha256 ${b.bundle_sha256.slice(0, 12)}…). Integrity of the export is not truth of every claim inside it.`);
    download('engram-bundle.json', b.bundle_json);
    $<HTMLElement>('cf-detail').innerHTML = `<details><summary>Verifier output (${esc(v.status)})</summary><pre>${esc(v.output_lines.join('\n'))}</pre></details>`;
  } catch (err) { say(`Bundle export failed: ${(err as Error).message}`); }
}
$<HTMLButtonElement>('bundle-btn').addEventListener('click', () => void preserveBundle());
$<HTMLButtonElement>('step-observe').addEventListener('click', () => $<HTMLButtonElement>('guide-btn').click());
$<HTMLButtonElement>('step-trace').addEventListener('click', () => {
  const id = SelectedMemory.get();
  if (!id) { say('Trace: select the suspicious memory first (step 1).'); return; }
  say(`Trace: provenance and custody for ${id} are in the inspector. Known links are the recorded chain; anything absent is shown as unknown, not filled in.`);
  $<HTMLElement>('inspector').scrollIntoView({ block: 'start' });
});
$<HTMLButtonElement>('step-understand').addEventListener('click', () => {
  if (!lastImpact) { say('Understand: select a memory first so MNEME impact can be loaded.'); return; }
  say(`Understand: DIRECT = recorded receipt/decision. DERIVED = from recorded evidence. DERIVED (unattested) = a different actor retold it. POSSIBLE = co-served only, NOT causal. Lines and the inspector list use the same classes.`);
});
$<HTMLButtonElement>('step-compare').addEventListener('click', () => void runCounterfactual('exclusion'));
$<HTMLButtonElement>('step-preserve').addEventListener('click', () => void preserveBundle());

let zoom = 1;
function applyZoom(): void {
  $<HTMLElement>('viewport').style.transform = `scale(${zoom})`;
  $<HTMLElement>('viewport').style.transformOrigin = '0 0';
}
$<HTMLButtonElement>('zoom-in').addEventListener('click', () => { zoom = clampZoom(zoom + 0.1); applyZoom(); });
$<HTMLButtonElement>('zoom-out').addEventListener('click', () => { zoom = clampZoom(zoom - 0.1); applyZoom(); });
$<HTMLButtonElement>('fit-btn').addEventListener('click', () => {
  const pts = memories.map((m, i) => pos(m.memory_id, i));
  const w = Math.max(...pts.map((p) => p.x + 320), 320);
  const h = Math.max(...pts.map((p) => p.y + 200), 200);
  const board = $<HTMLElement>('board');
  zoom = fitScale({ w, h }, { w: board.clientWidth, h: board.clientHeight });
  applyZoom();
});
$<HTMLButtonElement>('reset-layout').addEventListener('click', () => {
  layout = {}; zoom = 1; localStorage.removeItem(LAYOUT_KEY); applyZoom(); renderCards();
  say('Layout reset. Only card positions changed — no MNEME state was touched.');
});
const VIEWS_KEY = 'engram.canvas.views.v1';
function loadViews(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}
function refreshViewSelect(): void {
  $<HTMLSelectElement>('view-select').innerHTML = '<option value="">Choose a saved view</option>'
    + Object.keys(loadViews()).sort().map((n) => `<option>${esc(n)}</option>`).join('');
}
$<HTMLButtonElement>('save-view').addEventListener('click', () => {
  const name = $<HTMLInputElement>('view-name').value.trim();
  if (!name) { say('Name the view first. Views store layout only, never evidence.'); return; }
  const views = loadViews(); views[name] = serializeLayout(layout);
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); refreshViewSelect();
  say(`View "${name}" saved (card positions only).`);
});
$<HTMLSelectElement>('view-select').addEventListener('change', () => {
  const name = $<HTMLSelectElement>('view-select').value;
  const raw = loadViews()[name];
  if (!raw) return;
  try { layout = JSON.parse(raw) as CardLayout; saveLayout(); renderCards(); } catch { say(`Saved view "${name}" is unreadable and was not applied.`); }
});
refreshViewSelect();

void boot();
