import { FastifyInstance } from "fastify";
import {
  createPrompt,
  getPrompt,
  listPromptsByProject,
  listAllActivePrompts,
  listDeletedPromptsByProject,
  updatePrompt,
  updatePromptStatus,
  assignAgent,
  deletePrompt,
  restorePrompt,
  hardDeletePrompt,
  PromptStatus,
} from "../firestore/prompts";
import { createSession } from "../firestore/sessions";
import { getAgent, sendToAgent } from "../websocket/agentRegistry";
import { db } from "../firestore/client";
import { logActivity } from "../middleware/activityLogger";
import { trackExecutionStarted } from "../telemetry/telemetryService";
import { loadLLMConfig, isValidProvider, ProviderName } from "../llm/config";
import { createProvider } from "../llm/index";
import { getSetting } from "../firestore/settings";
import { DEFAULT_REFINE_SYSTEM_PROMPT } from "./settings";

const VALID_STATUSES: PromptStatus[] = ["draft", "ready", "sent", "done"];

export function registerPromptRoutes(app: FastifyInstance) {
  app.patch("/prompts/reorder", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.project_id || typeof body.project_id !== "string") {
      return reply.status(400).send({ error: "project_id is required" });
    }
    if (!Array.isArray(body.prompt_ids) || body.prompt_ids.length === 0) {
      return reply.status(400).send({ error: "prompt_ids must be a non-empty array of strings" });
    }

    const promptIds = body.prompt_ids as string[];
    if (promptIds.some((id) => typeof id !== "string")) {
      return reply.status(400).send({ error: "prompt_ids must be an array of strings" });
    }

    // Fetch all prompts in one query to validate project consistency
    const prompts = await listPromptsByProject(body.project_id);
    const promptMap = new Map(prompts.map((p) => [p.id, p]));

    for (const id of promptIds) {
      const prompt = promptMap.get(id);
      if (!prompt) {
        return reply.status(400).send({ error: `prompt ${id} not found in project ${body.project_id}` });
      }
    }

    const beforeOrder = promptIds.map((id) => ({ id, order_index: promptMap.get(id)!.order_index }));

    // Batch update order_index sequentially
    const batch = db.batch();
    const collection = db.collection("prompts");

    for (let i = 0; i < promptIds.length; i++) {
      batch.update(collection.doc(promptIds[i]), { order_index: i });
    }

    await batch.commit();

    const afterOrder = promptIds.map((id, i) => ({ id, order_index: i }));

    await logActivity({
      project_id: body.project_id,
      entity_type: "prompt",
      entity_id: body.project_id,
      action_type: "reorder",
      metadata: { before_state: { order: beforeOrder }, after_state: { order: afterOrder } },
      actor: "user",
    });

    return { reordered: promptIds.length };
  });

  app.post("/prompts/:id/execute", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    if (!body.agent_id || typeof body.agent_id !== "string") {
      return reply.status(400).send({ error: "agent_id is required" });
    }

    const prompt = await getPrompt(id);
    if (!prompt) {
      return reply.status(404).send({ error: "prompt not found" });
    }
    if (prompt.status !== "ready") {
      return reply.status(400).send({ error: `prompt status is "${prompt.status}", must be "ready"` });
    }

    const agent = getAgent(body.agent_id);
    if (!agent) {
      return reply.status(404).send({ error: "agent not connected" });
    }
    if (agent.project_id !== prompt.project_id) {
      return reply.status(403).send({ error: "agent does not belong to this prompt's project" });
    }
    if (agent.status !== "idle") {
      return reply.status(409).send({ error: `agent is "${agent.status}", must be "idle"` });
    }

    const session = await createSession({
      project_id: prompt.project_id,
      agent_id: body.agent_id,
    });

    const sent = sendToAgent(body.agent_id, {
      type: "execute_prompt",
      prompt_id: id,
      session_id: session.id,
      text: prompt.body,
    });

    if (!sent) {
      return reply.status(502).send({ error: "failed to send to agent" });
    }

    await updatePromptStatus(id, "sent");
    await assignAgent(id, body.agent_id);

    trackExecutionStarted({
      agent_id: body.agent_id,
      prompt_id: id,
      session_id: session.id,
    });

    await logActivity({
      project_id: prompt.project_id,
      entity_type: "prompt",
      entity_id: id,
      action_type: "execute",
      metadata: {
        before_state: { status: prompt.status, agent_id: prompt.agent_id },
        after_state: { status: "sent", agent_id: body.agent_id },
        session_id: session.id,
      },
      actor: "user",
    });

    return {
      prompt_id: id,
      session_id: session.id,
      agent_id: body.agent_id,
      status: "sent",
    };
  });

  app.post("/prompts", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.project_id || typeof body.project_id !== "string") {
      return reply.status(400).send({ error: "project_id is required" });
    }
    if (body.title !== undefined && typeof body.title !== "string") {
      return reply.status(400).send({ error: "title must be a string" });
    }
    if (body.body !== undefined && typeof body.body !== "string") {
      return reply.status(400).send({ error: "body must be a string" });
    }
    if (body.order_index === undefined || typeof body.order_index !== "number") {
      return reply.status(400).send({ error: "order_index is required and must be a number" });
    }

    const parent_prompt_id =
      body.parent_prompt_id !== undefined && body.parent_prompt_id !== null
        ? String(body.parent_prompt_id)
        : null;

    const prompt = await createPrompt({
      project_id: body.project_id,
      parent_prompt_id,
      title: (body.title as string) || "",
      body: (body.body as string) || "",
      order_index: body.order_index,
    });

    await logActivity({
      project_id: body.project_id,
      entity_type: "prompt",
      entity_id: prompt.id,
      action_type: "create",
      metadata: { before_state: null, after_state: prompt as unknown as Record<string, unknown> },
      actor: "user",
    });

    return reply.status(201).send(prompt);
  });

  app.get("/prompts", async (req, reply) => {
    const { project_id } = req.query as { project_id?: string };

    if (project_id) {
      return listPromptsByProject(project_id);
    }

    return listAllActivePrompts();
  });

  app.get("/prompts/deleted", async (req, reply) => {
    const { project_id } = req.query as { project_id?: string };

    if (!project_id) {
      return reply.status(400).send({ error: "project_id query parameter is required" });
    }

    return listDeletedPromptsByProject(project_id);
  });

  app.post("/prompts/:id/restore", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "prompt is not deleted" });
    }

    await restorePrompt(id);

    const restored = await getPrompt(id);

    await logActivity({
      project_id: existing.project_id,
      entity_type: "prompt",
      entity_id: id,
      action_type: "restored",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: restored as unknown as Record<string, unknown> },
      actor: "user",
    });

    return restored;
  });

  app.post("/prompts/:id/permanent-delete", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "prompt must be archived before permanent deletion" });
    }

    await hardDeletePrompt(id);

    await logActivity({
      project_id: existing.project_id,
      entity_type: "prompt",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null, permanent: true },
      actor: "user",
    });

    return reply.status(204).send();
  });

  app.patch("/prompts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }

    const beforeState = { ...existing } as unknown as Record<string, unknown>;

    // Handle status transition separately
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as PromptStatus)) {
        return reply.status(400).send({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      await updatePromptStatus(id, body.status as PromptStatus);
    }

    // Handle field updates
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        return reply.status(400).send({ error: "title must be a string" });
      }
      updates.title = body.title;
    }
    if (body.body !== undefined) {
      if (typeof body.body !== "string") {
        return reply.status(400).send({ error: "body must be a string" });
      }
      updates.body = body.body;
    }
    if (body.parent_prompt_id !== undefined) {
      updates.parent_prompt_id = body.parent_prompt_id === null ? null : String(body.parent_prompt_id);
    }
    if (body.order_index !== undefined) {
      if (typeof body.order_index !== "number") {
        return reply.status(400).send({ error: "order_index must be a number" });
      }
      updates.order_index = body.order_index;
    }

    if (Object.keys(updates).length > 0) {
      await updatePrompt(id, updates);
    }

    const updated = await getPrompt(id);

    const skipLog = (req.query as Record<string, string>).skip_log === "true";
    if (!skipLog) {
      const actionType = body.status !== undefined && Object.keys(updates).length === 0
        ? "status_change" as const
        : "update" as const;

      await logActivity({
        project_id: existing.project_id,
        entity_type: "prompt",
        entity_id: id,
        action_type: actionType,
        metadata: { before_state: beforeState, after_state: updated as unknown as Record<string, unknown> },
        actor: "user",
      });
    }

    return updated;
  });

  app.delete("/prompts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }

    await deletePrompt(id);

    const afterState = await getPrompt(id);

    await logActivity({
      project_id: existing.project_id,
      entity_type: "prompt",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: afterState as unknown as Record<string, unknown> },
      actor: "user",
    });

    return reply.status(204).send();
  });

  app.post("/prompts/:id/refine", async (req, reply) => {
    const { id } = req.params as { id: string };

    const prompt = await getPrompt(id);
    if (!prompt) {
      return reply.status(404).send({ error: "prompt not found" });
    }

    const config = loadLLMConfig();
    const body = req.body as Record<string, unknown> | null;
    let providerName = config.defaultProvider as ProviderName;
    if (body?.provider && typeof body.provider === "string" && isValidProvider(body.provider)) {
      providerName = body.provider;
    }

    const providerConfig = config.providers[providerName];
    if (!providerConfig.configured) {
      return reply.status(400).send({ error: `Provider "${providerName}" is not configured` });
    }

    const model = typeof body?.model === "string" ? body.model : providerConfig.model;
    const provider = createProvider(providerName, { ...providerConfig, model });

    const refineSettings = await getSetting("refine");
    const systemPrompt =
      (refineSettings?.system_prompt as string) ||
      DEFAULT_REFINE_SYSTEM_PROMPT;

    const messages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: prompt.body,
      },
    ];

    console.log(`[refine] provider=${providerName} model=${model}`);
    console.log(`[refine] system_prompt:`, systemPrompt);
    console.log(`[refine] user_content:`, prompt.body);

    let refined = "";
    for await (const event of provider.stream(messages)) {
      if (event.type === "delta") refined += event.content;
      if (event.type === "error") {
        return reply.status(502).send({ error: event.error });
      }
    }

    return { original: prompt.body, refined: refined.trim(), prompt_id: id };
  });
}
