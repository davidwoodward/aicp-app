import { FastifyInstance } from "fastify";
import { loadLLMConfig, isValidProvider } from "../llm/config";
import { getSetting, upsertSetting } from "../firestore/settings";

interface SelectBody {
  provider: string;
  model: string;
}

export function registerModelRoutes(app: FastifyInstance) {
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

  app.post<{ Body: SelectBody }>("/models/select", async (req, reply) => {
    const { provider, model } = req.body;
    if (!provider || !model) {
      return reply.status(400).send({ error: "provider and model are required" });
    }
    const config = loadLLMConfig();
    if (!isValidProvider(provider)) {
      return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    }
    if (!config.providers[provider].configured) {
      return reply.status(400).send({ error: `Provider ${provider} is not configured` });
    }
    await upsertSetting("execution_llm", {
      provider,
      model,
      updated_at: Date.now(),
    });
    return { provider, model };
  });
}
