import { db } from "./client";

const collection = db.collection("snippets");

export interface Snippet {
  id: string;
  name: string;
  content: string;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createSnippet(
  data: Omit<Snippet, "id" | "created_at" | "updated_at">
): Promise<Snippet> {
  const doc = collection.doc();
  const now = new Date().toISOString();
  const snippet: Snippet = {
    id: doc.id,
    ...data,
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

export async function listSnippets(collectionId?: string): Promise<Snippet[]> {
  let query = collection.orderBy("updated_at", "desc") as FirebaseFirestore.Query;
  if (collectionId) {
    query = collection
      .where("collection_id", "==", collectionId)
      .orderBy("updated_at", "desc");
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as Snippet);
}

export async function updateSnippet(
  id: string,
  data: Partial<Pick<Snippet, "name" | "content" | "collection_id">>
): Promise<void> {
  await collection.doc(id).update({ ...data, updated_at: new Date().toISOString() });
}

export async function deleteSnippet(id: string): Promise<void> {
  await collection.doc(id).delete();
}
