import { FastifyInstance } from "fastify";

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok" };
  });
}
