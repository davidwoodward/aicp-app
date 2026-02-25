import { FastifyInstance } from "fastify";
import {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
} from "../firestore/conversations";
import {
  listChatMessagesByConversation,
  deleteChatMessagesByConversation,
} from "../firestore/chat-messages";
import { loadLLMConfig } from "../llm/config";

export function registerConversationRoutes(app: FastifyInstance) {
  app.get("/conversations", async () => {
    return listConversations();
  });

  app.post("/conversations", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const config = loadLLMConfig();

    const title = typeof body.title === "string" ? body.title : "New Chat";
    const provider = typeof body.provider === "string" ? body.provider : config.defaultProvider;
    const model = typeof body.model === "string"
      ? body.model
      : config.providers[provider as keyof typeof config.providers]?.model || "";

    const conversation = await createConversation({ title, model, provider });
    return reply.status(201).send(conversation);
  });

  app.get("/conversations/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const conversation = await getConversation(id);
    if (!conversation) {
      return reply.status(404).send({ error: "conversation not found" });
    }
    return conversation;
  });

  app.patch("/conversations/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getConversation(id);
    if (!existing) {
      return reply.status(404).send({ error: "conversation not found" });
    }

    const updates: Record<string, string> = {};
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.model === "string") updates.model = body.model;
    if (typeof body.provider === "string") updates.provider = body.provider;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    await updateConversation(id, updates);
    return { ...existing, ...updates };
  });

  app.delete("/conversations/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getConversation(id);
    if (!existing) {
      return reply.status(404).send({ error: "conversation not found" });
    }

    await deleteChatMessagesByConversation(id);
    await deleteConversation(id);
    return reply.status(204).send();
  });

  app.get("/conversations/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getConversation(id);
    if (!existing) {
      return reply.status(404).send({ error: "conversation not found" });
    }

    return listChatMessagesByConversation(id);
  });
}
