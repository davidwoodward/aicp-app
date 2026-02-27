import { db } from "./client";

export async function getSetting(key: string, userId?: string): Promise<Record<string, unknown> | null> {
  const docKey = userId ? `${key}:${userId}` : key;
  const doc = await db.collection("settings").doc(docKey).get();
  if (!doc.exists) return null;
  return doc.data() as Record<string, unknown>;
}

export async function upsertSetting(
  key: string,
  value: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const docKey = userId ? `${key}:${userId}` : key;
  await db.collection("settings").doc(docKey).set(value, { merge: true });
}
