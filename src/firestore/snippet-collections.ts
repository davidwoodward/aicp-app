import { db } from "./client";

const collection = db.collection("snippet_collections");

export interface SnippetCollection {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string;
  description: string;
  snippet_ids: string[];
  deleted_at: string | null;
  created_at: string;
}

export async function createSnippetCollection(
  data: Omit<SnippetCollection, "id" | "created_at" | "snippet_ids" | "deleted_at">
): Promise<SnippetCollection> {
  const doc = collection.doc();
  const snippetCollection: SnippetCollection = {
    id: doc.id,
    ...data,
    snippet_ids: [],
    deleted_at: null,
    created_at: new Date().toISOString(),
  };
  await doc.set(snippetCollection);
  return snippetCollection;
}

export async function getSnippetCollection(id: string): Promise<SnippetCollection | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as SnippetCollection;
}

export async function listSnippetCollections(userId: string): Promise<SnippetCollection[]> {
  const snapshot = await collection
    .where("user_id", "==", userId)
    .where("deleted_at", "==", null)
    .orderBy("created_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as SnippetCollection);
}

export async function listDeletedSnippetCollections(userId: string): Promise<SnippetCollection[]> {
  const snapshot = await collection
    .where("user_id", "==", userId)
    .where("deleted_at", "!=", null)
    .orderBy("deleted_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as SnippetCollection);
}

export async function updateSnippetCollection(
  id: string,
  data: Partial<Pick<SnippetCollection, "name" | "description" | "snippet_ids">>
): Promise<void> {
  await collection.doc(id).update(data);
}

export async function softDeleteSnippetCollection(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: new Date().toISOString() });
}

export async function restoreSnippetCollection(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: null });
}

export async function hardDeleteSnippetCollection(id: string): Promise<void> {
  await collection.doc(id).delete();
}
