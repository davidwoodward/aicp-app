import { FastifyInstance } from "fastify";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
} from "../firestore/projects";
import { logActivity } from "../middleware/activityLogger";

export function registerProjectRoutes(app: FastifyInstance) {
  app.post("/projects", async (req, reply) => {
    const { name, description } = req.body as Record<string, unknown>;

    if (!name || typeof name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }
    if (!description || typeof description !== "string") {
      return reply.status(400).send({ error: "description is required" });
    }

    const project = await createProject({ name, description });

    await logActivity({
      project_id: project.id,
      entity_type: "project",
      entity_id: project.id,
      action_type: "create",
      metadata: { before_state: null, after_state: project as unknown as Record<string, unknown> },
      actor: "user",
    });

    return reply.status(201).send(project);
  });

  app.get("/projects", async () => {
    return listProjects();
  });

  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(id);
    if (!project) {
      return reply.status(404).send({ error: "project not found" });
    }
    return project;
  });

  app.patch("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = await getProject(id);
    if (!existing) {
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
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "update",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: afterState as unknown as Record<string, unknown> },
      actor: "user",
    });

    return afterState;
  });

  app.delete("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getProject(id);
    if (!existing) {
      return reply.status(404).send({ error: "project not found" });
    }

    await deleteProject(id);

    await logActivity({
      project_id: id,
      entity_type: "project",
      entity_id: id,
      action_type: "delete",
      metadata: { before_state: existing as unknown as Record<string, unknown>, after_state: null },
      actor: "user",
    });

    return reply.status(204).send();
  });
}
