import { FastifyInstance } from "fastify";
import { listActivityLogs, EntityType } from "../middleware/activityLogger";

export function registerActivityLogRoutes(app: FastifyInstance) {
  app.get("/activity-logs", async (req) => {
    const query = req.query as Record<string, string>;

    const filters: {
      entity_type?: EntityType;
      entity_id?: string;
      project_id?: string;
    } = {};

    if (query.entity_type) filters.entity_type = query.entity_type as EntityType;
    if (query.entity_id) filters.entity_id = query.entity_id;
    if (query.project_id) filters.project_id = query.project_id;

    const logs = await listActivityLogs(filters);
    return logs;
  });
}
