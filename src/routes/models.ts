import { FastifyInstance } from "fastify";
import { loadLLMConfig, isValidProvider } from "../llm/config";
import { getSetting, upsertSetting } from "../firestore/settings";
import {
  getProviderStatuses,
  getRegistrySnapshot,
  setModelOverride,
  RegistryError,
} from "../llm/modelRegistry";

interface SelectBody {
  provider: string;
  model: string;
  project_id?: string;
}

export function registerModelRoutes(app: FastifyInstance) {
  // ── GET /models — existing endpoint (unchanged response shape) ────────
  app.get("/models", async () => {
    const config = loadLLMConfig();
    const setting = await getSetting("execution_llm").catch(() => null);

    return {
      default_provider: config.defaultProvider,
      selected_provider: (setting?.provider as string) ?? null,
      selected_model: (setting?.model as string) ?? null,
      providers: Object.entries(config.providers).map(([name, p]) => ({
        name,
        model: p.model,
        configured: p.configured,
      })),
    };
  });

  // ── GET /models/status — provider status with available models ────────
  app.get("/models/status", async () => {
    return getProviderStatuses();
  });

  // ── GET /models/registry — full snapshot with project overrides ────────
  app.get<{ Querystring: { project_id?: string } }>(
    "/models/registry",
    async (req) => {
      const projectId = req.query.project_id;
      return getRegistrySnapshot(projectId);
    },
  );

  // ── POST /models/select — save project model override ──────────────────
  app.post<{ Body: SelectBody }>("/models/select", async (req, reply) => {
    const { provider, model, project_id } = req.body;
    if (!provider || !model) {
      return reply.status(400).send({ error: "provider and model are required" });
    }

    try {
      const override = await setModelOverride(provider, model, project_id);
      return { provider: override.provider, model: override.model };
    } catch (err) {
      if (err instanceof RegistryError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
