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

export interface PaginatedLogs {
  logs: ActivityLog[];
  next_cursor: string | null;
  has_more: boolean;
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
  since?: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedLogs> {
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
  if (filters?.since) {
    query = query.where("created_at", ">=", filters.since);
  }

  // Cursor-based pagination: start after the cursor timestamp
  if (filters?.cursor) {
    query = query.startAfter(filters.cursor);
  }

  const cap = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 50;
  // Fetch one extra to determine has_more
  const snapshot = await query.limit(cap + 1).get();
  const docs = snapshot.docs.map((doc) => doc.data() as ActivityLog);

  const hasMore = docs.length > cap;
  const page = hasMore ? docs.slice(0, cap) : docs;
  const nextCursor = hasMore && page.length > 0
    ? page[page.length - 1].created_at
    : null;

  return {
    logs: page,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

export async function getActivityLog(id: string): Promise<ActivityLog | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as ActivityLog;
}

export async function deleteActivityLog(id: string): Promise<void> {
  await collection.doc(id).delete();
}
