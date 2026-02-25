import { WebSocket } from "ws";

// --- Types ---

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

type TelemetryEvent =
  | { type: "agent_connected"; agent: AgentTelemetry }
  | { type: "agent_disconnected"; agent_id: string }
  | { type: "agent_status"; agent_id: string; status: string }
  | { type: "execution_started"; execution: ExecutionTelemetry }
  | { type: "execution_completed"; execution: ExecutionTelemetry }
  | { type: "snapshot"; data: TelemetrySnapshot };

// --- In-memory state (never persisted) ---

const agents = new Map<string, AgentTelemetry>();
const activeExecutions = new Map<string, ExecutionTelemetry>();
const uiClients = new Set<WebSocket>();
let completedCount = 0;

// --- UI broadcast ---

export function addUIClient(socket: WebSocket): void {
  uiClients.add(socket);
  // Send current snapshot on connect
  send(socket, { type: "snapshot", data: getSnapshot() });
  socket.on("close", () => uiClients.delete(socket));
}

function broadcast(event: TelemetryEvent): void {
  const payload = JSON.stringify(event);
  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function send(socket: WebSocket, event: TelemetryEvent): void {
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
  broadcast({ type: "agent_connected", agent });
}

export function trackAgentDisconnected(agentId: string): void {
  agents.delete(agentId);
  // Clean up any orphaned executions for this agent
  for (const [id, exec] of activeExecutions) {
    if (exec.agent_id === agentId) {
      activeExecutions.delete(id);
    }
  }
  broadcast({ type: "agent_disconnected", agent_id: agentId });
}

export function trackAgentStatus(agentId: string, status: string): void {
  const agent = agents.get(agentId);
  if (agent) {
    agent.status = status as AgentTelemetry["status"];
  }
  broadcast({ type: "agent_status", agent_id: agentId, status });
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
  broadcast({ type: "execution_started", execution });
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

  activeExecutions.delete(executionId);
  completedCount++;
  broadcast({ type: "execution_completed", execution });
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
