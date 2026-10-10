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

async function get<T>(path: string): Promise<T> {
  if (!READ_TOKEN) {
    throw new Error(
      'VITE_ENGRAM_READ_TOKEN is not set. Copy client/.env.example to ' +
      'client/.env and fill it in with the same token the adapter was ' +
      'started with (ENGRAM_READ_TOKEN).',
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${READ_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`ENGRAM adapter ${path} -> HTTP ${res.status}`);
  }
  const envelope = (await res.json()) as Envelope<T>;
  return envelope.data;
}

export const EngramApi = {
  overview: () => get<FieldOverview>('/api/v1/field/overview'),
  listMemories: () =>
    get<{ total: number; memories: MemorySummary[] }>('/api/v1/memories?limit=200'),
  getMemory: (id: string) => get<MemoryDetail>(`/api/v1/memories/${encodeURIComponent(id)}`),
  getCustody: (id: string) =>
    get<CustodyChain>(`/api/v1/memories/${encodeURIComponent(id)}/custody`),
};
