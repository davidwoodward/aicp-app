import { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects";
import { registerPromptRoutes } from "./prompts";

export function registerRoutes(app: FastifyInstance) {
  app.register(
    async (api) => {
      api.get("/health", async () => {
        return { status: "ok" };
      });

      registerProjectRoutes(api);
      registerPromptRoutes(api);
    },
    { prefix: "/api" }
  );
}
