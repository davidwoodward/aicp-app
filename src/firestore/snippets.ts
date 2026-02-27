import { db } from "./client";

const collection = db.collection("snippets");

export interface Snippet {
  id: string;
  name: string;
  content: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createSnippet(
  data: Omit<Snippet, "id" | "created_at" | "updated_at" | "deleted_at">
): Promise<Snippet> {
  const doc = collection.doc();
  const now = new Date().toISOString();
  const snippet: Snippet = {
    id: doc.id,
    ...data,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };
  await doc.set(snippet);
  return snippet;
}

export async function getSnippet(id: string): Promise<Snippet | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Snippet;
}

export async function listSnippets(): Promise<Snippet[]> {
  const snapshot = await collection
    .where("deleted_at", "==", null)
    .orderBy("updated_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Snippet);
}

export async function listDeletedSnippets(): Promise<Snippet[]> {
  const snapshot = await collection
    .where("deleted_at", "!=", null)
    .orderBy("deleted_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Snippet);
}

export async function updateSnippet(
  id: string,
  data: Partial<Pick<Snippet, "name" | "content">>
): Promise<void> {
  await collection.doc(id).update({ ...data, updated_at: new Date().toISOString() });
}

export async function softDeleteSnippet(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: new Date().toISOString() });
}

export async function restoreSnippet(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: null, updated_at: new Date().toISOString() });
}

export async function hardDeleteSnippet(id: string): Promise<void> {
  await collection.doc(id).delete();
}
