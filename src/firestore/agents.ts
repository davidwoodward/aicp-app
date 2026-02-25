import { db } from "./client";

const collection = db.collection("agents");

export type AgentStatus = "idle" | "busy" | "offline";
export type ToolType = "claude_code";

export interface Agent {
  id: string;
  project_id: string;
  machine_name: string;
  tool_type: ToolType;
  status: AgentStatus;
  last_seen_at: string;
}

export async function createAgent(
  data: Omit<Agent, "id" | "status" | "last_seen_at">
): Promise<Agent> {
  const doc = collection.doc();
  const agent: Agent = {
    id: doc.id,
    ...data,
    status: "offline",
    last_seen_at: new Date().toISOString(),
  };
  await doc.set(agent);
  return agent;
}

export async function getAgent(id: string): Promise<Agent | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Agent;
}

export async function listAgentsByProject(projectId: string): Promise<Agent[]> {
  const snapshot = await collection
    .where("project_id", "==", projectId)
    .get();
  return snapshot.docs.map((doc) => doc.data() as Agent);
}

export async function updateAgentStatus(id: string, status: AgentStatus): Promise<void> {
  await collection.doc(id).update({
    status,
    last_seen_at: new Date().toISOString(),
  });
}

export async function updateHeartbeat(id: string): Promise<void> {
  await collection.doc(id).update({
    last_seen_at: new Date().toISOString(),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await collection.doc(id).delete();
}
