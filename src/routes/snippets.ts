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
import { logActivity } from "../middleware/activityLogger";

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

    await logActivity({
      project_id: null,
      entity_type: "snippet",
      entity_id: snippet.id,
      action_type: "create",
      metadata: { before_state: null, after_state: snippet as unknown as Record<string, unknown> },
      actor: "user",
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
    const afterState = { ...existing, ...updates };

    await logActivity({
      project_id: null,
      entity_type: "snippet",
      entity_id: id,
      action_type: "update",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: afterState as unknown as Record<string, unknown> },
      actor: "user",
    });

    return afterState;
  });

  app.delete("/snippets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }

    await deleteSnippet(id);

    await logActivity({
      project_id: null,
      entity_type: "snippet",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null },
      actor: "user",
    });

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

    const snippetCollection = await createSnippetCollection({
      name: body.name,
      description: typeof body.description === "string" ? body.description : "",
    });

    await logActivity({
      project_id: null,
      entity_type: "snippet_collection",
      entity_id: snippetCollection.id,
      action_type: "create",
      metadata: { before_state: null, after_state: snippetCollection as unknown as Record<string, unknown> },
      actor: "user",
    });

    return reply.status(201).send(snippetCollection);
  });

  app.delete("/snippet-collections/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }

    await deleteSnippetCollection(id);

    await logActivity({
      project_id: null,
      entity_type: "snippet_collection",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null },
      actor: "user",
    });

    return reply.status(204).send();
  });
}
