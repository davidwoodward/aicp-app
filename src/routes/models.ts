import { FastifyInstance } from "fastify";
import { loadLLMConfig, loadUserLLMConfig } from "../llm/config";
import { getSetting } from "../firestore/settings";
import { getUserSettings } from "../firestore/user-settings";
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
  app.get("/models", async (req) => {
    const userSettings = await getUserSettings(req.user.id);
    const config = userSettings?.llm_keys
      ? loadUserLLMConfig(userSettings.llm_keys)
      : loadLLMConfig();
    const setting = await getSetting("execution_llm", req.user.id).catch(() => null);

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
  app.get("/models/status", async (req) => {
    const userSettings = await getUserSettings(req.user.id);
    return getProviderStatuses(userSettings?.llm_keys);
  });

  // ── GET /models/registry — full snapshot with project overrides ────────
  app.get<{ Querystring: { project_id?: string } }>(
    "/models/registry",
    async (req) => {
      const projectId = req.query.project_id;
      const userSettings = await getUserSettings(req.user.id);
      return getRegistrySnapshot(projectId, userSettings?.llm_keys);
    },
  );

  // ── POST /models/select — save project model override ──────────────────
  app.post<{ Body: SelectBody }>("/models/select", async (req, reply) => {
    const { provider, model, project_id } = req.body;
    if (!provider || !model) {
      return reply.status(400).send({ error: "provider and model are required" });
    }

    try {
      const userSettings = await getUserSettings(req.user.id);
      const override = await setModelOverride(provider, model, project_id, userSettings?.llm_keys);
      return { provider: override.provider, model: override.model };
    } catch (err) {
      if (err instanceof RegistryError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
