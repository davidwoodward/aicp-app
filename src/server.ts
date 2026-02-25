import path from "path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes";
import { registerWebSocket } from "./websocket";
import "./firestore/client";

const app = Fastify({ logger: true });

async function start() {
  app.log.info(`Firestore initialized for project: ${process.env.FIRESTORE_PROJECT_ID}`);

  await app.register(websocket);

  registerRoutes(app);
  registerWebSocket(app);

  // Serve frontend static files in production
  const frontendDir = path.join(__dirname, "..", "frontend", "dist");
  await app.register(fastifyStatic, {
    root: frontendDir,
    wildcard: false,
  });

  // SPA fallback: serve index.html for non-API, non-WS routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/ws")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  const PORT = parseInt(process.env.PORT || "8080", 10);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(
    `Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`
  );
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
