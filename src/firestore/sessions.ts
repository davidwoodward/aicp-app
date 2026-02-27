import { db } from "./client";

const collection = db.collection("sessions");

export interface Session {
  id: string;
  user_id: string;
  tenant_id: string;
  project_id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
}

export async function createSession(
  data: Omit<Session, "id" | "started_at" | "ended_at">
): Promise<Session> {
  const doc = collection.doc();
  const session: Session = {
    id: doc.id,
    ...data,
    started_at: new Date().toISOString(),
    ended_at: null,
  };
  await doc.set(session);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Session;
}

export async function listSessionsByProject(projectId: string): Promise<Session[]> {
  const snapshot = await collection
    .where("project_id", "==", projectId)
    .orderBy("started_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Session);
}

export async function listSessionsByAgent(agentId: string): Promise<Session[]> {
  const snapshot = await collection
    .where("agent_id", "==", agentId)
    .orderBy("started_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Session);
}

export async function endSession(id: string): Promise<void> {
  await collection.doc(id).update({
    ended_at: new Date().toISOString(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await collection.doc(id).delete();
}
