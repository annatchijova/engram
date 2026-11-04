/**
 * ENGRAM Canvas — pure presentation logic for the 2D investigation surface.
 *
 * Boundary (deterministic-core / llm-out-of-the-loop): this module never
 * computes custody, authority, confidence or causality. Every consequential
 * value arrives already sealed by MNEME through EngramApi and is carried
 * verbatim (confidence stays the server TEXT string; hashes stay strings).
 * The only numbers computed here are card x/y positions — presentation
 * floats that never enter any seal, verdict or MNEME command.
 */
import type { CounterfactualDelta, CustodyChain, ImpactReport, MemorySummary } from '../engram-api.js';

export type EdgeClass = 'DIRECT' | 'DERIVED' | 'DERIVED_UNATTESTED' | 'POSSIBLE';

export const EDGE_LABEL: Record<EdgeClass, string> = {
  DIRECT: 'DIRECT — receipt/decision recorded by MNEME',
  DERIVED: 'DERIVED — derived from recorded evidence',
  DERIVED_UNATTESTED: 'DERIVED (unattested) — declarant differs from decision actor',
  POSSIBLE: 'POSSIBLE — co-served/resonant only, NOT causal',
};

/** Same hex values as XR CUSTODY_COLOR (field-system.ts) plus glyph + text, so status never rides on color alone. */
export const CUSTODY_PRESENTATION: Record<string, { hex: string; glyph: string; label: string }> = {
  CLEAN: { hex: '#3fa34d', glyph: '●', label: 'Clean' },
  TAINT_FLAGGED: { hex: '#e0a62b', glyph: '▲', label: 'Taint flagged' },
  QUARANTINED: { hex: '#c13030', glyph: '■', label: 'Quarantined' },
  SUPERSEDED: { hex: '#6b6f76', glyph: '◆', label: 'Superseded' },
};

export type CanvasEdge = {
  source: string;
  target: string;
  cls: EdgeClass;
  /** Human label that travels with the line; meaning never rides on color or distance alone. */
  label: string;
};

export function custodyPresentation(status: string): { hex: string; glyph: string; label: string } {
  // Unknown stays unknown (I9): an unrecognized status is never shown as CLEAN.
  return CUSTODY_PRESENTATION[status] ?? { hex: '#555555', glyph: '?', label: `Unrecognized status: ${status}` };
}

export type CardLayout = Record<string, { x: number; y: number }>;

/** Dragging mutates layout only (I2). Returns a new map; the memory object is untouched. */
export function applyDrag(layout: CardLayout, memoryId: string, x: number, y: number): CardLayout {
  return { ...layout, [memoryId]: { x: Math.round(x), y: Math.round(y) } };
}

/** Deterministic layout serialization: keys sorted so the same layout always yields the same bytes. */
export function serializeLayout(layout: CardLayout): string {
  const sorted: CardLayout = {};
  for (const key of Object.keys(layout).sort()) sorted[key] = layout[key]!;
  return JSON.stringify(sorted);
}

/**
 * Typed connections come only from MNEME ImpactReport lists. Spatial
 * distance plays no part: the class is read from which list the server
 * returned, so two cards far apart can be DIRECT and two neighbours can
 * be merely POSSIBLE. The same pair may carry several classes at once.
 */
export function buildEdges(impact: ImpactReport): CanvasEdge[] {
  const seen = new Set<string>();
  const edges: CanvasEdge[] = [];
  const push = (target: string, cls: EdgeClass): void => {
    const key = `${impact.memory_id}->${target}:${cls}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: impact.memory_id, target, cls, label: EDGE_LABEL[cls] });
  };
  for (const id of impact.derived_memories) push(id, 'DERIVED');
  for (const id of impact.derived_unattested) push(id, 'DERIVED_UNATTESTED');
  for (const id of impact.possible_memories) push(id, 'POSSIBLE');
  return edges;
}

export type WorldPartition = {
  factual: string[];
  hypothetical: string[];
  removedFromServing: string[];
  enteredTopK: string[];
};

/**
 * Counterfactual isolation (I5): the delta is query-scoped, not two whole
 * worlds. served_b is a hypothetical serving list for one query; it is
 * returned in its own bucket and never merged into the factual card set.
 */
export function partitionCounterfactual(delta: CounterfactualDelta): WorldPartition {
  return {
    factual: [...delta.served_a],
    hypothetical: [...delta.served_b],
    removedFromServing: [...delta.removed_from_serving],
    enteredTopK: [...delta.entered_top_k],
  };
}

/** On comparison failure the hypothetical is discarded, never reused; factual state is retained as-is. */
export function onCounterfactualError<T extends { hypothetical: WorldPartition | null }>(state: T): T {
  return { ...state, hypothetical: null };
}

/** Stale-snapshot guard (I7): a staged commit may only run against the field_version it previewed. */
export function canCommit(stagedFieldVersion: number | null, currentFieldVersion: number | null): { ok: boolean; reason: string } {
  if (stagedFieldVersion === null) return { ok: false, reason: 'No preview staged. Run the preview first (stage is not commit).' };
  if (currentFieldVersion === null) return { ok: false, reason: 'Current field version unknown. Refresh before committing.' };
  if (stagedFieldVersion !== currentFieldVersion) {
    return { ok: false, reason: `Stale snapshot: preview staged at field_version ${stagedFieldVersion}, field is now ${currentFieldVersion}. Re-run the preview.` };
  }
  return { ok: true, reason: 'Staged preview matches the current field version.' };
}

/** Widening counterfactual disclosure requires a session (MNEME COUNTERFACTUAL capability); narrowing does not. */
export function wideningGuard(sessionToken: string | null): { ok: boolean; reason: string } {
  if (!sessionToken) return { ok: false, reason: 'Containment effect is a widening disclosure: log in first so MNEME can check the COUNTERFACTUAL capability. The exclusion effect (narrowing) works with the read token.' };
  return { ok: true, reason: 'Session present; MNEME remains the authority that grants or refuses.' };
}

export function custodySummary(chain: CustodyChain | null): string {
  if (!chain || chain.chain_length === 0) return 'Custody history unavailable from the adapter. Status unknown — not assumed clean.';
  return `Custody chain: ${chain.chain_length} entr${chain.chain_length === 1 ? 'y' : 'ies'}, head ${chain.head_hash.slice(0, 12)}…`;
}

/** First memory the server itself marks compromised; the UI never invents the designation. */
export function findCompromised(memories: MemorySummary[]): MemorySummary | null {
  return memories.find((m) => m.custody_status === 'TAINT_FLAGGED' || m.custody_status === 'QUARANTINED') ?? null;
}

/** Board viewport (presentation only): zoom is clamped, fit is computed from card bounds, never from evidence values. */
export function clampZoom(z: number): number {
  return Math.min(2, Math.max(0.4, Math.round(z * 20) / 20));
}

export function fitScale(bounds: { w: number; h: number }, view: { w: number; h: number }): number {
  if (bounds.w <= 0 || bounds.h <= 0) return 1;
  return clampZoom(Math.min(view.w / bounds.w, view.h / bounds.h));
}

/** Escape untrusted memory content before any innerHTML interpolation (malicious-content regression). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Structural custody-link check: flags a broken chain as invalid, never as clean. Display aid only; the bundle verifier remains authoritative. */
export function validateCustodyLinks(chain: CustodyChain | null): boolean {
  if (!chain || chain.chain_length === 0) return false;
  let prev: string | null = null;
  for (const [i, e] of chain.entries.entries()) {
    if (e.seq !== i) return false;
    if (prev !== null && e.prev_hash !== prev) return false;
    prev = e.entry_hash;
  }
  return prev === chain.head_hash || chain.entries.length === 0;
}

/** Advisory session freshness; the server still decides expiry (401) — this only improves the message. */
export function isSessionValid(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt > now;
}

export type ConnectionDiagnosis = {
  state: 'connected' | 'server-unavailable' | 'mneme-unavailable' | 'auth-required' | 'schema-mismatch' | 'empty-investigation';
  message: string;
};

/**
 * Connection honesty: five distinguishable states, each with its next
 * action. A network failure is never rendered as an empty investigation,
 * and an empty field is never rendered as a connection failure.
 */
export function diagnoseConnection(opts: {
  reachable: boolean;
  httpStatus: number | null;
  protocolMatches: boolean | null;
  totalMemories: number | null;
  healthStatus: string | null;
}): ConnectionDiagnosis {
  if (!opts.reachable) {
    return { state: 'server-unavailable', message: 'Server unavailable: the adapter did not answer. Start it with ./scripts/dev-local.sh from the repo root, then reload. No data was invented.' };
  }
  if (opts.httpStatus === 503) {
    return { state: 'mneme-unavailable', message: 'MNEME unavailable: the adapter answered but the field database is missing or unseeded (HTTP 503). Seed with python3 seed_demo_field.py in server/, then reload. This is not an empty investigation.' };
  }
  if (opts.httpStatus === 401 || opts.httpStatus === 500) {
    return { state: 'auth-required', message: `Authentication required (HTTP ${opts.httpStatus}): the read token is missing or does not match ENGRAM_READ_TOKEN on the adapter. Align client/.env and restart Vite.` };
  }
  if (opts.protocolMatches === false) {
    return { state: 'schema-mismatch', message: 'API schema mismatch: the adapter speaks a different protocol version than this client expects (engram-query/v1). Update client and adapter together.' };
  }
  if (opts.totalMemories === 0) {
    return { state: 'empty-investigation', message: 'Connected, but the field is empty: seed the demonstration with python3 seed_demo_field.py in server/, then reload.' };
  }
  const degraded = opts.healthStatus && opts.healthStatus !== 'ok' ? ` Adapter health reports "${opts.healthStatus}" — check /health before trusting the field.` : '';
  return { state: 'connected', message: `Connected to the MNEME adapter.${degraded}` };
}

export type JsonCanvasExport = { json: string; warnings: string[] };

/** Optional JSON Canvas interop. Edge labels carry the class as text; typed MNEME semantics do not survive as authority. */
export function buildJsonCanvas(memories: MemorySummary[], layout: CardLayout, edges: CanvasEdge[]): JsonCanvasExport {
  const nodes = memories.map((m, i) => ({
    id: m.memory_id, type: 'text', text: `${m.memory_id}\n${m.content_preview}`,
    x: layout[m.memory_id]?.x ?? (i % 4) * 340, y: layout[m.memory_id]?.y ?? Math.floor(i / 4) * 220,
  }));
  const jcEdges = edges.map((e, i) => ({
    id: `engram-edge-${i}`, fromNode: e.source, toNode: e.target, label: e.label,
  }));
  const warnings = [
    'JSON Canvas edges are generic: DIRECT/DERIVED/DERIVED_UNATTESTED/POSSIBLE survive only as label text, not as enforceable MNEME semantics.',
    'Custody status, confidence, hashes, snapshot and authority data are NOT exported; re-importing this file cannot recreate them.',
    'Layout coordinates are presentation state, never authoritative memory state.',
  ];
  return { json: JSON.stringify({ nodes, edges: jcEdges }, null, 2), warnings };
}
