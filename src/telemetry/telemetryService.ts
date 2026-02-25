import { WebSocket } from "ws";

// --- Exported TelemetryEvent schema (for external consumers) ---

export interface TelemetryEvent {
  type: "agent_status" | "execution_start" | "execution_end" | "token_usage";
  tenant_id: string;
  agent_id: string;
  prompt_id?: string;
  model?: string;
  duration_ms?: number;
  tokens?: number;
  timestamp: number;
}

// --- Internal types ---

export interface AgentTelemetry {
  agent_id: string;
  project_id: string;
  status: "idle" | "busy" | "offline";
  connected_at: number;
}

export interface ExecutionTelemetry {
  execution_id: string;
  agent_id: string;
  prompt_id: string;
  session_id: string;
  model?: string;
  provider?: string;
  started_at: number;
  ended_at?: number;
  duration_ms?: number;
  token_usage?: { input_tokens?: number; output_tokens?: number };
}

export interface TelemetrySnapshot {
  connected_agents: AgentTelemetry[];
  active_executions: ExecutionTelemetry[];
  completed_count: number;
  timestamp: number;
}

/** Internal broadcast event — carries tenant_id for scoped delivery. */
type BroadcastEvent =
  | { type: "agent_connected"; tenant_id: string; agent: AgentTelemetry }
  | { type: "agent_disconnected"; tenant_id: string; agent_id: string }
  | { type: "agent_status"; tenant_id: string; agent_id: string; status: string }
  | { type: "execution_started"; tenant_id: string; execution: ExecutionTelemetry }
  | { type: "execution_completed"; tenant_id: string; execution: ExecutionTelemetry }
  | { type: "snapshot"; data: TelemetrySnapshot };

// --- In-memory state (never persisted) ---

const agents = new Map<string, AgentTelemetry>();
const activeExecutions = new Map<string, ExecutionTelemetry>();
let completedCount = 0;

/** UI clients keyed by socket, value tracks which tenant they subscribed to (null = all). */
const uiClients = new Map<WebSocket, { tenant_id: string | null }>();

// --- Broadcast throttle (250ms batching per tenant) ---

const BROADCAST_INTERVAL_MS = 250;

/** Pending events keyed by tenant_id ("*" = tenant-less). */
const pendingEvents = new Map<string, BroadcastEvent[]>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(flushPendingEvents, BROADCAST_INTERVAL_MS);
}

function flushPendingEvents(): void {
  if (pendingEvents.size === 0) {
    // No events queued — stop the timer to avoid idle CPU
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    return;
  }

  for (const [tenantKey, events] of pendingEvents) {
    if (events.length === 0) continue;

    // Build a single payload array for the batch
    const batch = events.length === 1
      ? JSON.stringify(events[0])
      : JSON.stringify({ type: "batch", events });

    for (const [client, meta] of uiClients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      // Only deliver to clients subscribed to this specific tenant
      if (meta.tenant_id !== null && meta.tenant_id === tenantKey) {
        client.send(batch);
      }
    }
  }

  pendingEvents.clear();
}

// --- UI broadcast ---

export function addUIClient(socket: WebSocket, tenantId?: string): void {
  uiClients.set(socket, { tenant_id: tenantId ?? null });

  // Send filtered snapshot on connect (immediate, not batched)
  const snap = tenantId ? getSnapshotForTenant(tenantId) : getSnapshot();
  send(socket, { type: "snapshot", data: snap });

  socket.on("close", () => uiClients.delete(socket));
}

/**
 * Queue a broadcast event for delivery on the next 250ms tick.
 * Snapshot events bypass the queue and are sent immediately.
 */
function broadcast(event: BroadcastEvent): void {
  const tenantKey = "tenant_id" in event ? event.tenant_id : "*";

  if (!pendingEvents.has(tenantKey)) {
    pendingEvents.set(tenantKey, []);
  }
  pendingEvents.get(tenantKey)!.push(event);

  ensureFlushTimer();
}

function send(socket: WebSocket, event: BroadcastEvent): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

// --- Agent tracking ---

export function trackAgentConnected(agentId: string, projectId: string): void {
  const agent: AgentTelemetry = {
    agent_id: agentId,
    project_id: projectId,
    status: "idle",
    connected_at: Date.now(),
  };
  agents.set(agentId, agent);
  broadcast({ type: "agent_connected", tenant_id: projectId, agent });
}

export function trackAgentDisconnected(agentId: string): void {
  const agent = agents.get(agentId);
  const tenantId = agent?.project_id ?? "";
  agents.delete(agentId);
  // Clean up any orphaned executions for this agent
  for (const [id, exec] of activeExecutions) {
    if (exec.agent_id === agentId) {
      activeExecutions.delete(id);
    }
  }
  broadcast({ type: "agent_disconnected", tenant_id: tenantId, agent_id: agentId });
}

export function trackAgentStatus(agentId: string, status: string): void {
  const agent = agents.get(agentId);
  const tenantId = agent?.project_id ?? "";
  if (agent) {
    agent.status = status as AgentTelemetry["status"];
  }
  broadcast({ type: "agent_status", tenant_id: tenantId, agent_id: agentId, status });
}

// --- Execution tracking ---

export function trackExecutionStarted(params: {
  agent_id: string;
  prompt_id: string;
  session_id: string;
  model?: string;
  provider?: string;
}): string {
  const execution_id = `exec_${Date.now()}_${params.prompt_id.slice(0, 8)}`;
  const execution: ExecutionTelemetry = {
    execution_id,
    agent_id: params.agent_id,
    prompt_id: params.prompt_id,
    session_id: params.session_id,
    model: params.model,
    provider: params.provider,
    started_at: Date.now(),
  };
  activeExecutions.set(execution_id, execution);

  const agent = agents.get(params.agent_id);
  const tenantId = agent?.project_id ?? "";
  broadcast({ type: "execution_started", tenant_id: tenantId, execution });
  return execution_id;
}

export function trackExecutionCompleted(
  executionId: string,
  tokenUsage?: { input_tokens?: number; output_tokens?: number }
): void {
  const execution = activeExecutions.get(executionId);
  if (!execution) return;

  execution.ended_at = Date.now();
  execution.duration_ms = execution.ended_at - execution.started_at;
  if (tokenUsage) {
    execution.token_usage = tokenUsage;
  }

  const agent = agents.get(execution.agent_id);
  const tenantId = agent?.project_id ?? "";

  activeExecutions.delete(executionId);
  completedCount++;
  broadcast({ type: "execution_completed", tenant_id: tenantId, execution });
}

// Find active execution by session_id (for completion from agent messages)
export function findExecutionBySession(sessionId: string): string | undefined {
  for (const [id, exec] of activeExecutions) {
    if (exec.session_id === sessionId) return id;
  }
  return undefined;
}

// --- Snapshot ---

export function getSnapshot(): TelemetrySnapshot {
  return {
    connected_agents: Array.from(agents.values()),
    active_executions: Array.from(activeExecutions.values()),
    completed_count: completedCount,
    timestamp: Date.now(),
  };
}

/** Filtered snapshot for a specific tenant (project). */
function getSnapshotForTenant(tenantId: string): TelemetrySnapshot {
  return {
    connected_agents: Array.from(agents.values()).filter(
      (a) => a.project_id === tenantId,
    ),
    active_executions: Array.from(activeExecutions.values()).filter((e) => {
      const agent = agents.get(e.agent_id);
      return agent?.project_id === tenantId;
    }),
    completed_count: completedCount,
    timestamp: Date.now(),
  };
}
