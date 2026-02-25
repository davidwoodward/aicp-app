import { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects";
import { registerPromptRoutes } from "./prompts";
import { registerConversationRoutes } from "./conversations";
import { registerSnippetRoutes } from "./snippets";
import { registerModelRoutes } from "./models";
import { registerChatRoutes } from "./chat";

export function registerRoutes(app: FastifyInstance) {
  app.register(
    async (api) => {
      api.get("/health", async () => {
        return { status: "ok" };
      });

      registerProjectRoutes(api);
      registerPromptRoutes(api);
      registerConversationRoutes(api);
      registerSnippetRoutes(api);
      registerModelRoutes(api);
      registerChatRoutes(api);
    },
    { prefix: "/api" }
  );
}
