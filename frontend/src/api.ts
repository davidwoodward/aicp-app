const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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
  providers: ModelInfo[];
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnippetCollection {
  id: string;
  name: string;
  description: string;
  created_at: string;
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
};

// --- Prompts ---

export const prompts = {
  list: (projectId: string) => request<Prompt[]>(`/prompts?project_id=${projectId}`),
  create: (data: {
    project_id: string;
    title: string;
    body: string;
    order_index: number;
    parent_prompt_id?: string | null;
  }) => request<Prompt>('/prompts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<Prompt>(`/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/prompts/${id}`, { method: 'DELETE' }),
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
};

// --- Snippets ---

export const snippets = {
  list: (collectionId?: string) =>
    request<Snippet[]>(collectionId ? `/snippets?collection_id=${collectionId}` : '/snippets'),
  get: (id: string) => request<Snippet>(`/snippets/${id}`),
  create: (data: { name: string; content: string; collection_id?: string | null }) =>
    request<Snippet>('/snippets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Snippet, 'name' | 'content' | 'collection_id'>>) =>
    request<Snippet>(`/snippets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/snippets/${id}`, { method: 'DELETE' }),
};

export const snippetCollections = {
  list: () => request<SnippetCollection[]>('/snippet-collections'),
  create: (data: { name: string; description?: string }) =>
    request<SnippetCollection>('/snippet-collections', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/snippet-collections/${id}`, { method: 'DELETE' }),
};

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
