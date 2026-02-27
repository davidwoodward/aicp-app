import { FastifyInstance } from "fastify";
import { listAgentsByProject } from "../firestore/agents";

export function registerAgentRoutes(app: FastifyInstance) {
  app.get("/agents", async (request, reply) => {
    const { project_id } = request.query as { project_id?: string };
    if (!project_id) {
      return reply.status(400).send({ error: "project_id is required" });
    }
    const agents = await listAgentsByProject(project_id);
    return agents;
  });
}
