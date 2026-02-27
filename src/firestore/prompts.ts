import { db } from "./client";

const collection = db.collection("prompts");

export type PromptStatus = "draft" | "ready" | "sent" | "done";

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

export async function createPrompt(
  data: Omit<Prompt, "id" | "created_at" | "sent_at" | "done_at" | "deleted_at" | "status" | "agent_id">
): Promise<Prompt> {
  const doc = collection.doc();
  const prompt: Prompt = {
    id: doc.id,
    ...data,
    status: "draft",
    agent_id: null,
    created_at: new Date().toISOString(),
    sent_at: null,
    done_at: null,
    deleted_at: null,
  };
  await doc.set(prompt);
  return prompt;
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Prompt;
}

export async function listPromptsByProject(projectId: string): Promise<Prompt[]> {
  const snapshot = await collection
    .where("project_id", "==", projectId)
    .orderBy("order_index", "asc")
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as Prompt)
    .filter((p) => !p.deleted_at);
}

export async function listDeletedPromptsByProject(projectId: string): Promise<Prompt[]> {
  const snapshot = await collection
    .where("project_id", "==", projectId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as Prompt)
    .filter((p) => !!p.deleted_at)
    .sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!));
}

export async function listAllPromptsByProject(projectId: string): Promise<Prompt[]> {
  const snapshot = await collection
    .where("project_id", "==", projectId)
    .orderBy("order_index", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Prompt);
}

export async function updatePrompt(
  id: string,
  data: Partial<Pick<Prompt, "title" | "body" | "parent_prompt_id" | "order_index">>
): Promise<void> {
  await collection.doc(id).update(data);
}

export async function updatePromptStatus(id: string, status: PromptStatus): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === "sent") updates.sent_at = new Date().toISOString();
  if (status === "done") updates.done_at = new Date().toISOString();
  await collection.doc(id).update(updates);
}

export async function assignAgent(id: string, agentId: string): Promise<void> {
  await collection.doc(id).update({ agent_id: agentId });
}

export async function deletePrompt(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: new Date().toISOString() });
}

export async function restorePrompt(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: null });
}

export async function hardDeletePrompt(id: string): Promise<void> {
  await collection.doc(id).delete();
}
