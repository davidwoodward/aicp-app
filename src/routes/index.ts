import { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects";
import { registerPromptRoutes } from "./prompts";
import { registerConversationRoutes } from "./conversations";
import { registerSnippetRoutes } from "./snippets";
import { registerModelRoutes } from "./models";
import { registerChatRoutes } from "./chat";
import { registerRestoreRoutes } from "./restore";
import { registerPlanRoutes } from "./plan";
import { registerActivityLogRoutes } from "./activity-logs";
import { registerCompositionRoutes } from "./compositions";
import { registerAgentRoutes } from "./agents";
import { registerSettingsRoutes } from "./settings";

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
      registerRestoreRoutes(api);
      registerPlanRoutes(api);
      registerActivityLogRoutes(api);
      registerCompositionRoutes(api);
      registerAgentRoutes(api);
      registerSettingsRoutes(api);
    },
    { prefix: "/api" }
  );
}
