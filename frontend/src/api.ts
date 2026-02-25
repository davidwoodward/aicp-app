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
