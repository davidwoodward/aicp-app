import { FastifyInstance } from "fastify";
import {
  createPrompt,
  getPrompt,
  listPromptsByProject,
  updatePrompt,
  updatePromptStatus,
  assignAgent,
  deletePrompt,
  PromptStatus,
} from "../firestore/prompts";
import { createSession } from "../firestore/sessions";
import { getAgent, sendToAgent } from "../websocket/agentRegistry";
import { db } from "../firestore/client";

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

    // Batch update order_index sequentially
    const batch = db.batch();
    const collection = db.collection("prompts");

    for (let i = 0; i < promptIds.length; i++) {
      batch.update(collection.doc(promptIds[i]), { order_index: i });
    }

    await batch.commit();
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
    if (!body.title || typeof body.title !== "string") {
      return reply.status(400).send({ error: "title is required" });
    }
    if (!body.body || typeof body.body !== "string") {
      return reply.status(400).send({ error: "body is required" });
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
      title: body.title,
      body: body.body,
      order_index: body.order_index,
    });
    return reply.status(201).send(prompt);
  });

  app.get("/prompts", async (req, reply) => {
    const { project_id } = req.query as { project_id?: string };

    if (!project_id) {
      return reply.status(400).send({ error: "project_id query parameter is required" });
    }

    return listPromptsByProject(project_id);
  });

  app.patch("/prompts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }

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
    return updated;
  });

  app.delete("/prompts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getPrompt(id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }

    await deletePrompt(id);
    return reply.status(204).send();
  });
}
