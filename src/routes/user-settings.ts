import { FastifyInstance } from "fastify";
import { getUser } from "../firestore/users";
import { getUserSettings, upsertUserSettings } from "../firestore/user-settings";
import type { LLMKeys } from "../firestore/user-settings";

function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export function registerUserSettingsRoutes(app: FastifyInstance) {
  // --- Profile ---

  app.get("/user/profile", async (req, reply) => {
    const user = await getUser(req.user.id);
    if (!user) return reply.status(404).send({ error: "User not found" });
    return user;
  });

  app.patch("/user/profile", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const user = await getUser(req.user.id);
    if (!user) return reply.status(404).send({ error: "User not found" });

    // Only name is editable
    if (typeof body.name !== "string") {
      return reply.status(400).send({ error: "name must be a string" });
    }

    const { db } = await import("../firestore/client");
    const now = new Date().toISOString();
    await db.collection("users").doc(req.user.id).update({
      name: body.name,
      updated_at: now,
    });

    return { ...user, name: body.name, updated_at: now };
  });

  // --- Models / LLM Keys ---

  app.get("/user/models", async (req) => {
    const settings = await getUserSettings(req.user.id);
    const keys = settings?.llm_keys || {};

    return {
      gemini_api_key: maskKey(keys.gemini_api_key),
      openai_api_key: maskKey(keys.openai_api_key),
      anthropic_api_key: maskKey(keys.anthropic_api_key),
    };
  });

  app.patch("/user/models", async (req) => {
    const body = req.body as Record<string, unknown>;
    const llmKeys: LLMKeys = {};

    if (typeof body.gemini_api_key === "string") llmKeys.gemini_api_key = body.gemini_api_key;
    if (typeof body.openai_api_key === "string") llmKeys.openai_api_key = body.openai_api_key;
    if (typeof body.anthropic_api_key === "string") llmKeys.anthropic_api_key = body.anthropic_api_key;

    const settings = await upsertUserSettings(req.user.id, {
      tenant_id: req.user.tenant_id,
      llm_keys: llmKeys,
    });

    return {
      gemini_api_key: maskKey(settings.llm_keys.gemini_api_key),
      openai_api_key: maskKey(settings.llm_keys.openai_api_key),
      anthropic_api_key: maskKey(settings.llm_keys.anthropic_api_key),
    };
  });
}
