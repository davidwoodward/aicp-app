import { FastifyInstance } from "fastify";
import { listActivityLogs, getActivityLog, deleteActivityLog, EntityType } from "../middleware/activityLogger";
import { computeDiff, type DiffResult } from "../services/diffEngine";
import { parseDuration } from "../commands/grammarEngine";

export function registerActivityLogRoutes(app: FastifyInstance) {
  app.get("/activity-logs", async (req, reply) => {
    const query = req.query as Record<string, string>;

    // Require at least one scope constraint to prevent unscoped queries
    if (!query.project_id && !query.entity_id) {
      return reply.status(400).send({ error: "project_id or entity_id is required" });
    }

    const filters: {
      entity_type?: EntityType;
      entity_id?: string;
      project_id?: string;
      since?: string;
      limit?: number;
      cursor?: string;
    } = {};

    if (query.entity_type) filters.entity_type = query.entity_type as EntityType;
    if (query.entity_id) filters.entity_id = query.entity_id;
    if (query.project_id) filters.project_id = query.project_id;

    // Parse --since duration (e.g. "1h", "7d") into an ISO timestamp
    if (query.since) {
      const ms = parseDuration(query.since);
      if (ms !== null) {
        filters.since = new Date(Date.now() - ms).toISOString();
      } else {
        // Treat as ISO timestamp directly
        filters.since = query.since;
      }
    }

    // Parse --limit
    if (query.limit) {
      const n = parseInt(query.limit, 10);
      if (!isNaN(n) && n > 0) filters.limit = n;
    }

    // Cursor for pagination
    if (query.cursor) {
      filters.cursor = query.cursor;
    }

    return listActivityLogs(filters);
  });

  app.get("/logs/:event_id/diff", async (req, reply) => {
    const { event_id } = req.params as { event_id: string };
    const query = req.query as Record<string, string>;

    const event = await getActivityLog(event_id);
    if (!event) {
      return reply.status(404).send({ error: "activity log event not found" });
    }

    // If caller provides project_id, verify event belongs to that project
    if (query.project_id && event.project_id && query.project_id !== event.project_id) {
      return reply.status(403).send({ error: "event does not belong to this project" });
    }

    const diffs = computeDiff(
      event.metadata.before_state,
      event.metadata.after_state,
    );

    const result: DiffResult = {
      event_id: event.id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      action_type: event.action_type,
      diffs,
      computed_at: new Date().toISOString(),
    };

    return result;
  });

  app.delete("/activity-logs/:event_id", async (req, reply) => {
    const { event_id } = req.params as { event_id: string };
    const event = await getActivityLog(event_id);
    if (!event) return reply.status(404).send({ error: "not found" });
    await deleteActivityLog(event_id);
    return { deleted: true };
  });
}
