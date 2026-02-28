import { db } from "./client";
import { encrypt, decrypt, isEncrypted } from "../crypto";

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

const KEY_FIELDS: (keyof LLMKeys)[] = ["gemini_api_key", "openai_api_key", "anthropic_api_key"];

function encryptKeys(keys: LLMKeys): LLMKeys {
  const out: LLMKeys = {};
  for (const field of KEY_FIELDS) {
    const val = keys[field];
    if (val) out[field] = encrypt(val);
  }
  return out;
}

function decryptKeys(keys: LLMKeys): LLMKeys {
  const out: LLMKeys = {};
  for (const field of KEY_FIELDS) {
    const val = keys[field];
    if (val) {
      out[field] = isEncrypted(val) ? decrypt(val) : val;
    }
  }
  return out;
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const doc = await collection.doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data() as UserSettings;
  return { ...data, llm_keys: decryptKeys(data.llm_keys || {}) };
}

export async function upsertUserSettings(
  userId: string,
  data: { tenant_id: string; llm_keys: LLMKeys },
): Promise<UserSettings> {
  const now = new Date().toISOString();
  const existing = await getUserSettings(userId);
  const encryptedKeys = encryptKeys(data.llm_keys);

  if (existing) {
    // Re-encrypt existing keys that aren't being updated
    const mergedPlain = { ...existing.llm_keys, ...data.llm_keys };
    const mergedEncrypted = encryptKeys(mergedPlain);
    const updates = {
      llm_keys: mergedEncrypted,
      updated_at: now,
    };
    await collection.doc(userId).update(updates);
    return { ...existing, llm_keys: mergedPlain, updated_at: now };
  }

  const settings: UserSettings = {
    user_id: userId,
    tenant_id: data.tenant_id,
    llm_keys: encryptedKeys,
    updated_at: now,
  };
  await collection.doc(userId).set(settings);
  return { ...settings, llm_keys: data.llm_keys };
}
