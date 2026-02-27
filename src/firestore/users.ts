import { db } from "./client";

const collection = db.collection("users");

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  picture: string;
  created_at: string;
  updated_at: string;
}

export async function getUser(id: string): Promise<User | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as User;
}

export async function upsertUser(data: {
  id: string;
  email: string;
  name: string;
  picture: string;
}): Promise<User> {
  const now = new Date().toISOString();
  const existing = await getUser(data.id);

  if (existing) {
    const updates = {
      email: data.email,
      name: data.name,
      picture: data.picture,
      updated_at: now,
    };
    await collection.doc(data.id).update(updates);
    return { ...existing, ...updates };
  }

  const user: User = {
    id: data.id,
    tenant_id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
    created_at: now,
    updated_at: now,
  };
  await collection.doc(data.id).set(user);
  return user;
}
