import { FastifyInstance } from "fastify";
import {
  previewComposition,
  applyComposition,
} from "../services/compositionEngine";
import { getPrompt } from "../firestore/prompts";
import { logActivity } from "../middleware/activityLogger";

export function registerCompositionRoutes(app: FastifyInstance) {
  // Preview composed prompt without persisting
  app.post("/compositions/preview", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.prompt_id || typeof body.prompt_id !== "string") {
      return reply.status(400).send({ error: "prompt_id is required" });
    }
    if (!Array.isArray(body.snippet_order)) {
      return reply
        .status(400)
        .send({ error: "snippet_order must be an array of snippet IDs" });
    }

    const snippetOrder = body.snippet_order as string[];
    if (snippetOrder.some((id) => typeof id !== "string")) {
      return reply
        .status(400)
        .send({ error: "snippet_order must be an array of strings" });
    }

    try {
      const preview = await previewComposition({
        prompt_id: body.prompt_id,
        snippet_order: snippetOrder,
      });
      return preview;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "preview failed";
      if (message === "prompt not found") {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  // Compose and persist: writes composed body back to prompt
  app.post("/compositions/apply", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.prompt_id || typeof body.prompt_id !== "string") {
      return reply.status(400).send({ error: "prompt_id is required" });
    }
    if (!Array.isArray(body.snippet_order)) {
      return reply
        .status(400)
        .send({ error: "snippet_order must be an array of snippet IDs" });
    }

    const snippetOrder = body.snippet_order as string[];
    if (snippetOrder.some((id) => typeof id !== "string")) {
      return reply
        .status(400)
        .send({ error: "snippet_order must be an array of strings" });
    }

    // Capture before state for activity log
    const existing = await getPrompt(body.prompt_id);
    if (!existing) {
      return reply.status(404).send({ error: "prompt not found" });
    }

    try {
      const result = await applyComposition({
        prompt_id: body.prompt_id,
        snippet_order: snippetOrder,
      });

      const updated = await getPrompt(body.prompt_id);

      await logActivity({
        project_id: existing.project_id,
        entity_type: "prompt",
        entity_id: body.prompt_id,
        action_type: "update",
        metadata: {
          before_state: existing as unknown as Record<string, unknown>,
          after_state: updated as unknown as Record<string, unknown>,
          composition: { snippet_order: snippetOrder },
        },
        actor: "user",
      });

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "compose failed";
      return reply.status(500).send({ error: message });
    }
  });
}
