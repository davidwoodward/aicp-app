import { WebSocket } from "ws";
import { AgentStatus } from "../firestore/agents";

export interface ConnectedAgent {
  socket: WebSocket;
  agent_id: string;
  project_id: string;
  status: AgentStatus;
}

// agent_id → ConnectedAgent
const registry = new Map<string, ConnectedAgent>();

export function registerAgent(
  agentId: string,
  projectId: string,
  socket: WebSocket
): void {
  const existing = registry.get(agentId);
  if (existing) {
    existing.socket.close(1000, "replaced by new connection");
  }
  registry.set(agentId, {
    socket,
    agent_id: agentId,
    project_id: projectId,
    status: "idle",
  });
}

export function removeAgent(agentId: string): void {
  registry.delete(agentId);
}

export function removeBySocket(socket: WebSocket): string | null {
  for (const [agentId, entry] of registry) {
    if (entry.socket === socket) {
      registry.delete(agentId);
      return agentId;
    }
  }
  return null;
}

export function getAgent(agentId: string): ConnectedAgent | undefined {
  return registry.get(agentId);
}

export function setAgentStatus(agentId: string, status: AgentStatus): void {
  const entry = registry.get(agentId);
  if (entry) {
    entry.status = status;
  }
}

export function listAgentsByProject(projectId: string): ConnectedAgent[] {
  const result: ConnectedAgent[] = [];
  for (const entry of registry.values()) {
    if (entry.project_id === projectId) {
      result.push(entry);
    }
  }
  return result;
}

export function sendToAgent(
  agentId: string,
  message: { type: string; [key: string]: unknown }
): boolean {
  const entry = registry.get(agentId);
  if (!entry || entry.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  entry.socket.send(JSON.stringify(message));
  return true;
}
