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

export type Envelope<T> = {
  protocol_version: string;
  snapshot_as_of: string;
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
};

export type QuarantineResult = {
  sweep_id: string;
  quarantined_actor: string;
  initiated_by: string;
  flagged_memory_ids: string[];
  flagged_count: number;
  advisory_resonant_neighbours: string[];
};

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
  const res = await fetch(`${API_BASE}${path}`, {
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
  return envelope.data;
}

// login() posts credentials with no bearer token at all — it IS the
// token-issuing endpoint, so request() is called with token:'unused'
// to satisfy the helper's "a token is present" check without sending
// anything the server actually reads as a bearer credential.
async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
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
  ) =>
    request<QuarantineResult>(`/api/v1/actors/${encodeURIComponent(actorId)}/quarantine`, {
      method: 'POST',
      token: sessionToken,
      body: { reason, idempotency_key: idempotencyKey },
    }),
};
