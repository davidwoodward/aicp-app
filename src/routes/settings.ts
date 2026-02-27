import { FastifyInstance } from "fastify";
import { getSetting, upsertSetting } from "../firestore/settings";

const DEFAULT_REFINE_SYSTEM_PROMPT =
  "You are a prompt refinement assistant. Analyze the given prompt and return a well-structured, clearly-worded markdown version. Improve clarity, structure, and precision while preserving the original intent. Return ONLY the refined prompt in markdown format. No explanations, no preamble.";

const VALID_MODES = ["Manual", "Auto"] as const;

export function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/settings/refine", async (req) => {
    const doc = await getSetting("refine", req.user.id);
    return {
      mode: (doc?.mode as string) === "Auto" ? "Auto" : "Manual",
      system_prompt:
        typeof doc?.system_prompt === "string"
          ? doc.system_prompt
          : DEFAULT_REFINE_SYSTEM_PROMPT,
    };
  });

  app.patch("/settings/refine", async (req, reply) => {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "request body required" });
    }

    const updates: Record<string, unknown> = {};

    if (body.mode !== undefined) {
      if (
        typeof body.mode !== "string" ||
        !VALID_MODES.includes(body.mode as (typeof VALID_MODES)[number])
      ) {
        return reply
          .status(400)
          .send({ error: `mode must be one of: ${VALID_MODES.join(", ")}` });
      }
      updates.mode = body.mode;
    }

    if (body.system_prompt !== undefined) {
      if (typeof body.system_prompt !== "string") {
        return reply
          .status(400)
          .send({ error: "system_prompt must be a string" });
      }
      updates.system_prompt = body.system_prompt;
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    await upsertSetting("refine", updates, req.user.id);

    const doc = await getSetting("refine", req.user.id);
    return {
      mode: (doc?.mode as string) === "Auto" ? "Auto" : "Manual",
      system_prompt:
        typeof doc?.system_prompt === "string"
          ? doc.system_prompt
          : DEFAULT_REFINE_SYSTEM_PROMPT,
    };
  });
}

export { DEFAULT_REFINE_SYSTEM_PROMPT };
