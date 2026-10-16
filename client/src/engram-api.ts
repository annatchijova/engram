/**
 * ENGRAM — thin client for the Nivel 1 read adapter (server/app.py).
 *
 * AUTH PLACEHOLDER: the bearer token is baked into the client bundle via
 * Vite env vars. Anyone who opens devtools can read it. That is fine ONLY
 * because the adapter exposes zero mutating endpoint — see server/app.py's
 * module docstring. This is not the externally-authenticated XR actor
 * identity the architecture calls for; it is a hackathon placeholder,
 * named here so it is never mistaken for one.
 */

const API_BASE = (import.meta.env.VITE_ENGRAM_API_BASE as string | undefined) ??
  'http://localhost:8000';
const READ_TOKEN = import.meta.env.VITE_ENGRAM_READ_TOKEN as string | undefined;

// Nivel 5 — minimal check, not a hard gate: a real version-negotiation UI
// is out of scope. Mismatches are logged so a client/server skew is at
// least visible, matching the doc's "can an old client read a new
// protocol" adversarial question with an honest partial answer.
const EXPECTED_PROTOCOL_VERSION = 'engram-query/v1';

export type Envelope<T> = {
  protocol_version: string;
  // Wall-clock response time (server-named served_at), not a snapshot
  // boundary. The real ordering value to stage against is field_version.
  served_at: string;
  data: T;
};

export type FieldOverview = {
  total_memories: number;
  custody_status_distribution: Record<string, number>;
  custody_status_meaning: Record<string, string>;
  field_state_distribution: Record<string, number>;
  registered_actors: number;
  authority_ledger_exists: boolean;
  root_actors: string[];
  capability_vocabulary: string[];
  field_version: number;
};

export type MemorySummary = {
  memory_id: string;
  topic: string | null;
  field_state: string;
  custody_status: string;
  created_at: string;
  content_preview: string;
};

export type MemoryDetail = {
  memory_id: string;
  content: string;
  content_sha256: string;
  embedding_model: string;
  topic: string | null;
  created_by: string;
  created_at: string;
  field_state: string;
  custody_status: string;
  confidence: string;
  superseded_by: string | null;
};

export type CustodyEntry = {
  memory_id: string;
  seq: number;
  event_type: string;
  actor_id: string;
  reason: string;
  created_at: string;
  payload_json: string;
  prev_hash: string;
  entry_hash: string;
};

export type CustodyChain = {
  memory_id: string;
  chain_length: number;
  head_hash: string;
  entries: CustodyEntry[];
};

export type ImpactReport = {
  memory_id: string;
  direct_receipts: string[];
  direct_decisions: string[];
  derived_memories: string[];
  derived_unattested: string[];
  derived_decisions: string[];
  possible_memories: string[];
  impact_sha256: string;
};

export type CounterfactualDelta = {
  query_sha256: string;
  top_k: number;
  hops: number;
  world_a_override: [string, string][];
  world_b_override: [string, string][];
  served_a: string[];
  served_b: string[];
  receipt_a_sha256: string;
  receipt_b_sha256: string;
  removed_from_serving: string[];
  entered_top_k: string[];
  rank_changed: [string, number, number][];
  score_changed: [string, string, string][];
  claim_outcome_changed: [string, string, string][];
  decision_dependency_changed: string[];
  interference: boolean;
  summary: string;
  delta_sha256: string;
};

export type ActorSummary = {
  actor_id: string;
  display_name: string;
  kind: string;
  status: string;
};

export type LoginResult = {
  session_token: string;
  actor_id: string;
  display_name: string;
  effective_capabilities: string[];
  expires_in_seconds: number;
};

export type QuarantinePreview = {
  actor_id: string;
  already_quarantined: boolean;
  would_flag_memory_ids: string[];
  count: number;
  field_version: number;
};

export type BundleExport = {
  bundle_json: string;
  bundle_sha256: string;
  memory_count: number;
  verifier: {
    verified: boolean;
    // null when the verifier subprocess never ran (status distinguishes
    // VERIFIED / REJECTED / VERIFIER_UNAVAILABLE — a failed launch is not
    // a failed bundle).
    exit_code: number | null;
    status: string;
    output_lines: string[];
  };
};

export type QuarantineResult = {
  sweep_id: string;
  quarantined_actor: string;
  initiated_by: string;
  flagged_memory_ids: string[];
  flagged_count: number;
  advisory_resonant_neighbours: string[];
};

// A hung fetch in XR has no visible console — bound every request and name
// the failure, same lesson index.ts learned about invisible rejections.
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `ENGRAM adapter ${path} unreachable or timed out: ` +
      `${(err as Error).name === 'TimeoutError' ? `>${REQUEST_TIMEOUT_MS}ms` : String(err)}`,
    );
  }
}

// Protocol skew is a real condition, not a devtools footnote: surface one
// non-blocking badge (once) so an operator in the headset can see it.
let protocolWarningShown = false;
function showProtocolWarning(serverVersion: string): void {
  if (protocolWarningShown) return;
  protocolWarningShown = true;
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:20;max-width:360px;' +
    'background:#2a230e;border:1px solid #a58a3a;border-radius:8px;' +
    'padding:10px 12px;color:#ffe9b8;font:12px monospace;white-space:pre-wrap;';
  el.textContent =
    `ENGRAM: protocol skew — client expects ${EXPECTED_PROTOCOL_VERSION}, ` +
    `server sent ${serverVersion}. Results may be stale.`;
  document.body.appendChild(el);
}

async function request<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const token = opts.token ?? READ_TOKEN;
  if (!token) {
    throw new Error(
      'VITE_ENGRAM_READ_TOKEN is not set. Copy client/.env.example to ' +
      'client/.env and fill it in with the same token the adapter was ' +
      'started with (ENGRAM_READ_TOKEN).',
    );
  }
  const res = await fetchWithTimeout(path, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      `ENGRAM adapter ${path} -> HTTP ${res.status}` +
      (detail?.detail ? `: ${detail.detail}` : ''),
    );
  }
  const envelope = (await res.json()) as Envelope<T>;
  if (envelope.protocol_version !== EXPECTED_PROTOCOL_VERSION) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ENGRAM] protocol version mismatch: client expects ` +
      `${EXPECTED_PROTOCOL_VERSION}, server sent ${envelope.protocol_version}.`,
    );
    showProtocolWarning(envelope.protocol_version);
  }
  return envelope.data;
}

// login() posts credentials with no bearer token at all — it IS the
// token-issuing endpoint, so request() is called with token:'unused'
// to satisfy the helper's "a token is present" check without sending
// anything the server actually reads as a bearer credential.
async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetchWithTimeout('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `login failed: HTTP ${res.status}`);
  }
  const envelope = (await res.json()) as Envelope<LoginResult>;
  return envelope.data;
}

export const EngramApi = {
  overview: () => request<FieldOverview>('/api/v1/field/overview'),
  listMemories: () =>
    request<{ total: number; memories: MemorySummary[] }>('/api/v1/memories?limit=200'),
  getMemory: (id: string) => request<MemoryDetail>(`/api/v1/memories/${encodeURIComponent(id)}`),
  getCustody: (id: string) =>
    request<CustodyChain>(`/api/v1/memories/${encodeURIComponent(id)}/custody`),
  getImpact: (id: string) =>
    request<ImpactReport>(`/api/v1/memories/${encodeURIComponent(id)}/impact`),
  listActors: () => request<{ actors: ActorSummary[] }>('/api/v1/actors'),
  previewQuarantine: (actorId: string) =>
    request<QuarantinePreview>(`/api/v1/actors/${encodeURIComponent(actorId)}/quarantine-preview`),
  login,
  commitQuarantine: (
    actorId: string,
    sessionToken: string,
    reason: string,
    idempotencyKey: string,
    expectedFieldVersion: number,
  ) =>
    request<QuarantineResult>(`/api/v1/actors/${encodeURIComponent(actorId)}/quarantine`, {
      method: 'POST',
      token: sessionToken,
      body: {
        reason, idempotency_key: idempotencyKey,
        expected_field_version: expectedFieldVersion,
      },
    }),
  exclusionEffect: () =>
    request<CounterfactualDelta>('/api/v1/counterfactual/exclusion-effect'),
  containmentEffect: (sessionToken: string) =>
    request<CounterfactualDelta>('/api/v1/counterfactual/containment-effect', {
      token: sessionToken,
    }),
  exportBundle: () => request<BundleExport>('/api/v1/bundle/export'),
};
