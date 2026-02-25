import { db } from "../firestore/client";

const collection = db.collection("activity_logs");

export type EntityType = "project" | "prompt" | "conversation" | "snippet" | "snippet_collection";
export type ActionType = "create" | "update" | "delete" | "status_change" | "reorder" | "execute" | "restored";
export type Actor = "user" | "system" | "llm";

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

export async function logActivity(
  data: Omit<ActivityLog, "id" | "created_at">
): Promise<ActivityLog> {
  const doc = collection.doc();
  const log: ActivityLog = {
    id: doc.id,
    ...data,
    created_at: new Date().toISOString(),
  };
  await doc.set(log);
  return log;
}

export async function listActivityLogs(filters?: {
  entity_type?: EntityType;
  entity_id?: string;
  project_id?: string;
}): Promise<ActivityLog[]> {
  let query = collection.orderBy("created_at", "desc") as FirebaseFirestore.Query;

  if (filters?.entity_type) {
    query = query.where("entity_type", "==", filters.entity_type);
  }
  if (filters?.entity_id) {
    query = query.where("entity_id", "==", filters.entity_id);
  }
  if (filters?.project_id) {
    query = query.where("project_id", "==", filters.project_id);
  }

  const snapshot = await query.limit(200).get();
  return snapshot.docs.map((doc) => doc.data() as ActivityLog);
}

export async function getActivityLog(id: string): Promise<ActivityLog | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as ActivityLog;
}
