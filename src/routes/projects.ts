import { FastifyInstance } from "fastify";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
} from "../firestore/projects";

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
    return { ...existing, ...updates };
  });

  app.delete("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await getProject(id);
    if (!existing) {
      return reply.status(404).send({ error: "project not found" });
    }

    await deleteProject(id);
    return reply.status(204).send();
  });
}
