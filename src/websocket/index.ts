import { FastifyInstance } from "fastify";

export function registerWebSocket(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    app.log.info("WebSocket client connected");

    socket.on("message", (data: Buffer) => {
      const message = data.toString();
      app.log.info({ msg: "Received", data: message });
      socket.send(JSON.stringify({ echo: message }));
    });

    socket.on("close", () => {
      app.log.info("WebSocket client disconnected");
    });
  });
}
