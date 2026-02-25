import { db } from "./client";

const collection = db.collection("snippet_collections");

export interface SnippetCollection {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export async function createSnippetCollection(
  data: Omit<SnippetCollection, "id" | "created_at">
): Promise<SnippetCollection> {
  const doc = collection.doc();
  const snippetCollection: SnippetCollection = {
    id: doc.id,
    ...data,
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

export async function listSnippetCollections(): Promise<SnippetCollection[]> {
  const snapshot = await collection.orderBy("created_at", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as SnippetCollection);
}

export async function deleteSnippetCollection(id: string): Promise<void> {
  await collection.doc(id).delete();
}
