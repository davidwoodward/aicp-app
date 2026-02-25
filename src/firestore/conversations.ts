import { db } from "./client";

const collection = db.collection("conversations");

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export async function createConversation(
  data: Omit<Conversation, "id" | "created_at" | "updated_at">
): Promise<Conversation> {
  const doc = collection.doc();
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: doc.id,
    ...data,
    created_at: now,
    updated_at: now,
  };
  await doc.set(conversation);
  return conversation;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Conversation;
}

export async function listConversations(): Promise<Conversation[]> {
  const snapshot = await collection.orderBy("updated_at", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as Conversation);
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, "title" | "model" | "provider">>
): Promise<void> {
  await collection.doc(id).update({ ...data, updated_at: new Date().toISOString() });
}

export async function deleteConversation(id: string): Promise<void> {
  await collection.doc(id).delete();
}
