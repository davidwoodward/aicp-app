import { FastifyInstance } from "fastify";
import { verifyGoogleToken } from "../middleware/auth";
import { upsertUser } from "../firestore/users";

const ALLOWED_EMAILS = [
  "dawoodward@gmail.com",
  "david.woodward@permitsaige.com",
];

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const { id_token } = req.body as Record<string, unknown>;

    if (!id_token || typeof id_token !== "string") {
      return reply.status(400).send({ error: "id_token is required" });
    }

    try {
      const payload = await verifyGoogleToken(id_token);

      if (!ALLOWED_EMAILS.includes(payload.email)) {
        return reply.status(403).send({ error: "Email not authorized" });
      }

      const user = await upsertUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });

      return user;
    } catch {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
  });

  app.get("/auth/me", async (req) => {
    return req.user;
  });
}
