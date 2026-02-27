import { FastifyInstance } from "fastify";
import {
  createProject,
  getProject,
  listProjects,
  listDeletedProjects,
  updateProject,
  softDeleteProject,
  restoreProject,
  hardDeleteProject,
} from "../firestore/projects";
import { listPromptsByProject } from "../firestore/prompts";
import { listSessionsByProject } from "../firestore/sessions";
import { logActivity } from "../middleware/activityLogger";
import { computeTreeMetrics } from "../services/planMetrics";

export function registerProjectRoutes(app: FastifyInstance) {
  app.post("/projects", async (req, reply) => {
    const { name, description } = req.body as Record<string, unknown>;

    if (!name || typeof name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }
    if (!description || typeof description !== "string") {
      return reply.status(400).send({ error: "description is required" });
    }

    const project = await createProject({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      name,
      description,
    });

    await logActivity({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      project_id: project.id,
      entity_type: "project",
      entity_id: project.id,
      action_type: "create",
      metadata: { before_state: null, after_state: project as unknown as Record<string, unknown> },
      actor: "user",
    });

    return reply.status(201).send(project);
  });

  app.get("/projects", async (req) => {
    return listProjects(req.user.id);
  });

  app.get("/projects/deleted", async (req) => {
    return listDeletedProjects(req.user.id);
  });

  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(id);
    if (!project || project.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }
    return project;
  });

  app.get("/projects/:id/stats", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(id);
    if (!project || project.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }

    const [prompts, sessions] = await Promise.all([
      listPromptsByProject(id),
      listSessionsByProject(id),
    ]);

    return { prompts: prompts.length, sessions: sessions.length };
  });

  app.patch("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getProject(id);
    if (!existing || existing.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }

    const updates: Record<string, string> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return reply.status(400).send({ error: "name must be a string" });
      }
      updates.name = body.name;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return reply.status(400).send({ error: "description must be a string" });
      }
      updates.description = body.description;
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    await updateProject(id, updates);
    const afterState = { ...existing, ...updates };

    await logActivity({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "update",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: afterState as unknown as Record<string, unknown> },
      actor: "user",
    });

    return afterState;
  });

  app.get("/projects/:id/tree-metrics", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(id);
    if (!project || project.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }
    return computeTreeMetrics(id);
  });

  app.delete("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getProject(id);
    if (!existing || existing.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }

    await softDeleteProject(id);

    await logActivity({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null },
      actor: "user",
    });

    return reply.status(204).send();
  });

  app.post("/projects/:id/restore", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getProject(id);
    if (!existing || existing.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "project is not deleted" });
    }

    await restoreProject(id);

    await logActivity({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "restored",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: { ...existing, deleted_at: null } as unknown as Record<string, unknown> },
      actor: "user",
    });

    return { ...existing, deleted_at: null };
  });

  app.post("/projects/:id/permanent-delete", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getProject(id);
    if (!existing || existing.user_id !== req.user.id) {
      return reply.status(404).send({ error: "project not found" });
    }
    if (!existing.deleted_at) {
      return reply.status(400).send({ error: "project must be archived before permanent deletion" });
    }

    await hardDeleteProject(id);

    await logActivity({
      user_id: req.user.id,
      tenant_id: req.user.tenant_id,
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null, permanent: true },
      actor: "user",
    });

    return reply.status(204).send();
  });
}
