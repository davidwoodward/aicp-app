import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes";
import { registerWebSocket } from "./websocket";

const app = Fastify({ logger: true });

async function start() {
  await app.register(websocket);

  registerRoutes(app);
  registerWebSocket(app);

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
