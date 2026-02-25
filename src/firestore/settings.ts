import { db } from "./client";

export async function getSetting(key: string): Promise<Record<string, unknown> | null> {
  const doc = await db.collection("settings").doc(key).get();
  if (!doc.exists) return null;
  return doc.data() as Record<string, unknown>;
}

export async function upsertSetting(
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  await db.collection("settings").doc(key).set(value, { merge: true });
}
