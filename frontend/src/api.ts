const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...opts,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Types ---

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ProjectStats {
  prompts: number;
  sessions: number;
}

export type PromptStatus = 'draft' | 'ready' | 'sent' | 'done';

export interface Prompt {
  id: string;
  project_id: string;
  parent_prompt_id: string | null;
  title: string;
  body: string;
  status: PromptStatus;
  order_index: number;
  agent_id: string | null;
  created_at: string;
  sent_at: string | null;
  done_at: string | null;
  deleted_at: string | null;
}

export interface Agent {
  id: string;
  project_id: string;
  machine_name: string;
  tool_type: string;
  status: 'idle' | 'busy' | 'offline';
  last_seen_at: string;
}

export interface Session {
  id: string;
  project_id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'claude';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
  tool_call_id?: string;
  timestamp: string;
}

export interface ModelInfo {
  name: string;
  model: string;
  configured: boolean;
}

export interface ModelsResponse {
  default_provider: string;
  selected_provider: string | null;
  selected_model: string | null;
  providers: ModelInfo[];
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnippetCollection {
  id: string;
  name: string;
  description: string;
  snippet_ids: string[];
  deleted_at: string | null;
  created_at: string;
}

// --- Tree Metrics ---

export interface PromptMetrics {
  prompt_id: string;
  execution_count: number;
  last_execution_at: string | null;
  last_updated_at: string | null;
  activity_score: number;
  heatmap_level: 'neutral' | 'light' | 'medium' | 'strong';
  stale: boolean;
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface SubtreeTimeline {
  prompt_id: string;
  timeline: DayActivity[];
}

export interface TreeMetricsResponse {
  project_id: string;
  prompts: PromptMetrics[];
  subtree_timelines: SubtreeTimeline[];
  computed_at: string;
}

// --- Projects ---

export const projects = {
  list: () => request<Project[]>('/projects'),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { name: string; description: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Project, 'name' | 'description'>>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
  treeMetrics: (id: string) =>
    request<TreeMetricsResponse>(`/projects/${id}/tree-metrics`),
  stats: (id: string) =>
    request<ProjectStats>(`/projects/${id}/stats`),
  listDeleted: () => request<Project[]>('/projects/deleted'),
  restore: (id: string) =>
    request<Project>(`/projects/${id}/restore`, { method: 'POST' }),
  permanentDelete: (id: string) =>
    request<void>(`/projects/${id}/permanent-delete`, { method: 'POST' }),
};

// --- Prompts ---

export const prompts = {
  list: (projectId: string) => request<Prompt[]>(`/prompts?project_id=${projectId}`),
  listAll: () => request<Prompt[]>('/prompts'),
  listDeleted: (projectId: string) => request<Prompt[]>(`/prompts/deleted?project_id=${projectId}`),
  create: (data: {
    project_id: string;
    title: string;
    body: string;
    order_index: number;
    parent_prompt_id?: string | null;
  }) => request<Prompt>('/prompts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>, opts?: { skipLog?: boolean }) =>
    request<Prompt>(`/prompts/${id}${opts?.skipLog ? '?skip_log=true' : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/prompts/${id}`, { method: 'DELETE' }),
  restore: (id: string) =>
    request<Prompt>(`/prompts/${id}/restore`, { method: 'POST' }),
  permanentDelete: (id: string) =>
    request<void>(`/prompts/${id}/permanent-delete`, { method: 'POST' }),
  reorder: (projectId: string, promptIds: string[]) =>
    request<{ reordered: number }>('/prompts/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ project_id: projectId, prompt_ids: promptIds }),
    }),
  execute: (id: string, agentId: string) =>
    request<{ prompt_id: string; session_id: string; agent_id: string; status: string }>(
      `/prompts/${id}/execute`,
      { method: 'POST', body: JSON.stringify({ agent_id: agentId }) },
    ),
  refine: (id: string, provider?: string, model?: string) =>
    request<{ original: string; refined: string; prompt_id: string }>(
      `/prompts/${id}/refine`,
      { method: 'POST', body: JSON.stringify({ provider, model }) },
    ),
};

// --- Agents ---

export const agents = {
  listByProject: (projectId: string) =>
    request<Agent[]>(`/agents?project_id=${projectId}`),
};

// --- Sessions & Messages ---

export const sessions = {
  listByProject: (projectId: string) =>
    request<Session[]>(`/sessions?project_id=${projectId}`),
};

export const messages = {
  listBySession: (sessionId: string) =>
    request<Message[]>(`/messages?session_id=${sessionId}`),
};

// --- Conversations ---

export const conversations = {
  list: () => request<Conversation[]>('/conversations'),
  get: (id: string) => request<Conversation>(`/conversations/${id}`),
  create: (data?: { title?: string; provider?: string; model?: string }) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data || {}) }),
  update: (id: string, data: Partial<Pick<Conversation, 'title' | 'model' | 'provider'>>) =>
    request<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/conversations/${id}`, { method: 'DELETE' }),
  messages: (id: string) => request<ChatMessage[]>(`/conversations/${id}/messages`),
};

// --- Models ---

export const models = {
  list: () => request<ModelsResponse>('/models'),
  select: (provider: string, model: string) =>
    request<{ provider: string; model: string }>('/models/select', {
      method: 'POST',
      body: JSON.stringify({ provider, model }),
    }),
};

// --- Snippets ---

export const snippets = {
  list: () => request<Snippet[]>('/snippets'),
  get: (id: string) => request<Snippet>(`/snippets/${id}`),
  create: (data: { name: string; content: string }) =>
    request<Snippet>('/snippets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Snippet, 'name' | 'content'>>) =>
    request<Snippet>(`/snippets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/snippets/${id}`, { method: 'DELETE' }),
  listDeleted: () => request<Snippet[]>('/snippets/deleted'),
  restore: (id: string) =>
    request<Snippet>(`/snippets/${id}/restore`, { method: 'POST' }),
  permanentDelete: (id: string) =>
    request<void>(`/snippets/${id}/permanent-delete`, { method: 'POST' }),
};

export const snippetCollections = {
  list: () => request<SnippetCollection[]>('/snippet-collections'),
  create: (data: { name: string; description?: string }) =>
    request<SnippetCollection>('/snippet-collections', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<SnippetCollection, 'name' | 'description' | 'snippet_ids'>>) =>
    request<SnippetCollection>(`/snippet-collections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/snippet-collections/${id}`, { method: 'DELETE' }),
  listDeleted: () => request<SnippetCollection[]>('/snippet-collections/deleted'),
  restore: (id: string) =>
    request<SnippetCollection>(`/snippet-collections/${id}/restore`, { method: 'POST' }),
  permanentDelete: (id: string) =>
    request<void>(`/snippet-collections/${id}/permanent-delete`, { method: 'POST' }),
};

// --- Activity Logs ---

export type EntityType = 'project' | 'prompt' | 'conversation' | 'snippet' | 'snippet_collection';
export type ActionType = 'create' | 'update' | 'delete' | 'status_change' | 'reorder' | 'execute' | 'restored';
export type Actor = 'user' | 'system' | 'llm';

export interface ActivityLog {
  id: string;
  project_id: string | null;
  entity_type: EntityType;
  entity_id: string;
  action_type: ActionType;
  metadata: {
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  created_at: string;
  actor: Actor;
}

export interface PaginatedLogs {
  logs: ActivityLog[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface RestoreResult {
  restored: boolean;
  entity_type: EntityType;
  entity_id: string;
  restored_from_event: string;
  entity: Record<string, unknown>;
  forced?: boolean;
}

export interface RestoreConflict {
  error: 'conflict';
  detail: string;
  conflicts: FieldDiff[];
  event_id: string;
  entity_type: string;
  entity_id: string;
}

export class RestoreConflictError extends Error {
  conflict: RestoreConflict;
  constructor(conflict: RestoreConflict) {
    super(conflict.detail);
    this.name = 'RestoreConflictError';
    this.conflict = conflict;
  }
}

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface DiffResponse {
  event_id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  diffs: FieldDiff[];
  computed_at: string;
}

export const activityLogs = {
  list: (filters?: { entity_type?: EntityType; entity_id?: string; project_id?: string; since?: string; limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.cursor) params.set('cursor', filters.cursor);
    const qs = params.toString();
    return request<PaginatedLogs>(`/activity-logs${qs ? `?${qs}` : ''}`);
  },
  delete: (eventId: string) =>
    request<{ deleted: boolean }>(`/activity-logs/${eventId}`, { method: 'DELETE' }),
  diff: (eventId: string) =>
    request<DiffResponse>(`/logs/${eventId}/diff`),
  restore: async (eventId: string, force?: boolean): Promise<RestoreResult> => {
    const res = await fetch(`${BASE}/restore/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(force ? { force: true } : {}),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body.error === 'conflict') {
      throw new RestoreConflictError(body as RestoreConflict);
    }
    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return body as RestoreResult;
  },
};

// --- Compositions ---

export interface CompositionPreview {
  prompt_id: string;
  base_body: string;
  snippet_order: string[];
  resolved_snippets: Array<{
    id: string;
    name: string;
    content: string;
  }>;
  composed_body: string;
}

export interface CompositionResult {
  prompt_id: string;
  composed_body: string;
  snippet_order: string[];
  snippets_applied: number;
}

export const compositions = {
  preview: (promptId: string, snippetOrder: string[]) =>
    request<CompositionPreview>('/compositions/preview', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, snippet_order: snippetOrder }),
    }),
  apply: (promptId: string, snippetOrder: string[]) =>
    request<CompositionResult>('/compositions/apply', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, snippet_order: snippetOrder }),
    }),
};

// --- Settings ---

export type RefineMode = 'Manual' | 'Auto'
export interface RefineSettings { mode: RefineMode; system_prompt: string }

export const settings = {
  getRefine: () => request<RefineSettings>('/settings/refine'),
  updateRefine: (data: Partial<RefineSettings>) =>
    request<RefineSettings>('/settings/refine', { method: 'PATCH', body: JSON.stringify(data) }),
}

// --- Chat SSE ---

export interface ChatSSECallbacks {
  onConversation?: (data: { id: string }) => void;
  onDelta?: (data: { content: string }) => void;
  onToolCall?: (data: { id: string; name: string; arguments: string }) => void;
  onToolResult?: (data: { tool_call_id: string; name: string; result: string }) => void;
  onDone?: (data: { conversation_id: string }) => void;
  onError?: (data: { error: string }) => void;
}

export function sendChatMessage(
  params: {
    message: string;
    conversation_id?: string;
    provider?: string;
    model?: string;
  },
  callbacks: ChatSSECallbacks,
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        callbacks.onError?.({ error: body.error || `HTTP ${res.status}` });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case 'conversation': callbacks.onConversation?.(data); break;
                case 'delta': callbacks.onDelta?.(data); break;
                case 'tool_call': callbacks.onToolCall?.(data); break;
                case 'tool_result': callbacks.onToolResult?.(data); break;
                case 'done': callbacks.onDone?.(data); break;
                case 'error': callbacks.onError?.(data); break;
              }
            } catch { /* skip malformed */ }
            currentEvent = '';
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.({ error: err.message });
      }
    });

  return controller;
}
