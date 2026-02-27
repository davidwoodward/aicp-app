import { FastifyInstance } from "fastify";
import {
  createSnippet,
  getSnippet,
  listSnippets,
  listDeletedSnippets,
  updateSnippet,
  softDeleteSnippet,
  restoreSnippet,
  hardDeleteSnippet,
} from "../firestore/snippets";
import {
  createSnippetCollection,
  getSnippetCollection,
  listSnippetCollections,
  listDeletedSnippetCollections,
  updateSnippetCollection,
  softDeleteSnippetCollection,
  restoreSnippetCollection,
  hardDeleteSnippetCollection,
} from "../firestore/snippet-collections";
import { logActivity } from "../middleware/activityLogger";

export function registerSnippetRoutes(app: FastifyInstance) {
  // --- Snippets ---

  // Static routes BEFORE parametric :id routes
  app.get("/snippets/deleted", async () => {
    return listDeletedSnippets();
  });

  app.get("/snippets", async () => {
    return listSnippets();
  });

  app.post("/snippets", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (typeof body.name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }
    if (typeof body.content !== "string") {
      return reply.status(400).send({ error: "content is required" });
    }

    const snippet = await createSnippet({
      name: body.name,
      content: body.content,
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

  // Soft delete
  app.delete("/snippets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }

    await softDeleteSnippet(id);

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

  // Restore
  app.post("/snippets/:id/restore", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "snippet is not archived" });
    }

    await restoreSnippet(id);
    const restored = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };

    await logActivity({
      project_id: null,
      entity_type: "snippet",
      entity_id: id,
      action_type: "restored",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: restored as unknown as Record<string, unknown> },
      actor: "user",
    });

    return restored;
  });

  // Permanent delete
  app.post("/snippets/:id/permanent-delete", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippet(id);
    if (!existing) {
      return reply.status(404).send({ error: "snippet not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "snippet must be archived before permanent deletion" });
    }

    await hardDeleteSnippet(id);

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

  // Static routes BEFORE parametric :id routes
  app.get("/snippet-collections/deleted", async () => {
    return listDeletedSnippetCollections();
  });

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

  app.patch("/snippet-collections/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.description === "string") updates.description = body.description;
    if (Array.isArray(body.snippet_ids)) updates.snippet_ids = body.snippet_ids;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    await updateSnippetCollection(id, updates);
    const afterState = { ...existing, ...updates };

    await logActivity({
      project_id: null,
      entity_type: "snippet_collection",
      entity_id: id,
      action_type: "update",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: afterState as unknown as Record<string, unknown> },
      actor: "user",
    });

    return afterState;
  });

  // Soft delete
  app.delete("/snippet-collections/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }

    await softDeleteSnippetCollection(id);

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

  // Restore
  app.post("/snippet-collections/:id/restore", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "collection is not archived" });
    }

    await restoreSnippetCollection(id);
    const restored = { ...existing, deleted_at: null };

    await logActivity({
      project_id: null,
      entity_type: "snippet_collection",
      entity_id: id,
      action_type: "restored",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: restored as unknown as Record<string, unknown> },
      actor: "user",
    });

    return restored;
  });

  // Permanent delete
  app.post("/snippet-collections/:id/permanent-delete", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getSnippetCollection(id);
    if (!existing) {
      return reply.status(404).send({ error: "collection not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "collection must be archived before permanent deletion" });
    }

    await hardDeleteSnippetCollection(id);

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
