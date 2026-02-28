import { FastifyRequest, FastifyReply } from "fastify";
import { OAuth2Client } from "google-auth-library";

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  picture: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

const ALLOWED_EMAILS = [
  "dawoodward@gmail.com",
  "david.woodward@permitsaige.com",
];

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const oauthClient = new OAuth2Client(clientId);

export async function verifyGoogleToken(idToken: string): Promise<{
  sub: string;
  email: string;
  name: string;
  picture: string;
}> {
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid token payload");

  return {
    sub: payload.sub,
    email: payload.email || "",
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Only enforce auth on /api/* routes
  if (!request.url.startsWith("/api/")) return;

  // Skip auth for health check and login
  if (request.url === "/api/health" && request.method === "GET") return;
  if (request.url === "/api/auth/login" && request.method === "POST") return;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyGoogleToken(token);

    if (!ALLOWED_EMAILS.includes(payload.email)) {
      reply.code(403).send({ error: "Email not authorized" });
      return;
    }

    request.user = {
      id: payload.sub,
      tenant_id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}
