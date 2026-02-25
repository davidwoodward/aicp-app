import { FastifyInstance } from "fastify";
import {
  createSnippet,
  getSnippet,
  listSnippets,
  updateSnippet,
  deleteSnippet,
} from "../firestore/snippets";
import {
  createSnippetCollection,
  getSnippetCollection,
  listSnippetCollections,
  deleteSnippetCollection,
} from "../firestore/snippet-collections";

export function registerSnippetRoutes(app: FastifyInstance) {
  // --- Snippets ---

  app.get("/snippets", async (req) => {
    const { collection_id } = req.query as { collection_id?: string };
    return listSnippets(collection_id || undefined);
  });

  app.post("/snippets", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }
    if (!body.content || typeof body.content !== "string") {
      return reply.status(400).send({ error: "content is required" });
    }

    const snippet = await createSnippet({
      name: body.name,
      content: body.content,
      collection_id: typeof body.collection_id === "string" ? body.collection_id : null,
    });
    return reply.status(201).send(snippet);
  });

  app.get("/snippets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const snippet = await getSnippet(id);
    if (!snippet) {
      return reply.status(404).send({ error: "snippet not found" });
    }
    return snippet;
  });

  app.patch("/snippets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.content === "string") updates.content = body.content;
    if (body.collection_id !== undefined) {
      updates.collection_id = typeof body.collection_id === "string" ? body.collection_id : null;
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    await updateSnippet(id, updates);
    return { ...existing, ...updates };
  });

  app.delete("/snippets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }

    await deleteSnippet(id);
    return reply.status(204).send();
  });

  // --- Snippet Collections ---

  app.get("/snippet-collections", async () => {
    return listSnippetCollections();
  });

  app.post("/snippet-collections", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }

    const collection = await createSnippetCollection({
      name: body.name,
      description: typeof body.description === "string" ? body.description : "",
    });
    return reply.status(201).send(collection);
  });

  app.delete("/snippet-collections/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }

    await deleteSnippetCollection(id);
    return reply.status(204).send();
  });
}
