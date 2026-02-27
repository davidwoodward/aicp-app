import { db } from "./client";

const collection = db.collection("user_settings");

export interface LLMKeys {
  gemini_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
}

export interface UserSettings {
  user_id: string;
  tenant_id: string;
  llm_keys: LLMKeys;
  updated_at: string;
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const doc = await collection.doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as UserSettings;
}

export async function upsertUserSettings(
  userId: string,
  data: { tenant_id: string; llm_keys: LLMKeys },
): Promise<UserSettings> {
  const now = new Date().toISOString();
  const existing = await getUserSettings(userId);

  if (existing) {
    const updates = {
      llm_keys: { ...existing.llm_keys, ...data.llm_keys },
      updated_at: now,
    };
    await collection.doc(userId).update(updates);
    return { ...existing, ...updates };
  }

  const settings: UserSettings = {
    user_id: userId,
    tenant_id: data.tenant_id,
    llm_keys: data.llm_keys,
    updated_at: now,
  };
  await collection.doc(userId).set(settings);
  return settings;
}
