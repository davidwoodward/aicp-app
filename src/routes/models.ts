import { FastifyInstance } from "fastify";
import { loadLLMConfig } from "../llm/config";

export function registerModelRoutes(app: FastifyInstance) {
  app.get("/models", async () => {
    const config = loadLLMConfig();

    return {
      default_provider: config.defaultProvider,
      providers: Object.entries(config.providers).map(([name, p]) => ({
        name,
        model: p.model,
        configured: p.configured,
      })),
    };
  });
}
