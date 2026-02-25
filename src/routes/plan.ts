import { FastifyInstance } from "fastify";
import { interpret } from "../llm/controlPlane";
import { executeTool } from "../llm/tool-executor";
import { logActivity } from "../middleware/activityLogger";

interface PlanBody {
  message: string;
}

interface ApplyBody {
  action: string;
  payload: Record<string, unknown>;
}

export function registerPlanRoutes(app: FastifyInstance) {
  // Interpret user intent via control-plane LLM — read-only, no mutations
  app.post<{ Body: PlanBody }>("/plan", async (req, reply) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return reply.status(400).send({ error: "message is required" });
    }
    const result = await interpret(message);
    return result;
  });

  // Execute a previously confirmed plan — this is the only mutation path
  app.post<{ Body: ApplyBody }>("/plan/apply", async (req, reply) => {
    const { action, payload } = req.body;
    if (!action || typeof action !== "string") {
      return reply.status(400).send({ error: "action is required" });
    }
    if (action === "unknown") {
      return reply.status(400).send({ error: "Cannot apply an unknown action" });
    }

    const toolCall = {
      id: `plan-${Date.now()}`,
      name: action,
      arguments: JSON.stringify(payload ?? {}),
    };

    const resultStr = await executeTool(toolCall);

    let result: unknown;
    try {
      result = JSON.parse(resultStr);
    } catch {
      result = resultStr;
    }

    // Log the planned mutation
    const resultObj = result as Record<string, unknown> | null;
    await logActivity({
      project_id: (resultObj?.project_id as string) ?? null,
      entity_type: action.includes("project")
        ? "project"
        : action.includes("prompt")
          ? "prompt"
          : action.includes("snippet")
            ? "snippet"
            : "project",
      entity_id: (resultObj?.id as string) ?? "unknown",
      action_type: "create",
      metadata: {
        source: "planning_assist",
        action,
        payload,
        after_state: resultObj,
      },
      actor: "llm",
    }).catch(() => {}); // best-effort logging

    return { action, result };
  });
}
