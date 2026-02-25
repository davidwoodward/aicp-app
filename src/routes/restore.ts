import { FastifyInstance } from "fastify";
import { getActivityLog, logActivity, EntityType } from "../middleware/activityLogger";
import { db } from "../firestore/client";
import { getProject } from "../firestore/projects";
import { getPrompt } from "../firestore/prompts";
import { getConversation } from "../firestore/conversations";
import { getSnippet } from "../firestore/snippets";
import { getSnippetCollection } from "../firestore/snippet-collections";
import { computeDiff, type FieldDiff } from "../services/diffEngine";

const COLLECTION_MAP: Record<EntityType, string> = {
  project: "projects",
  prompt: "prompts",
  conversation: "conversations",
  snippet: "snippets",
  snippet_collection: "snippet_collections",
};

const GETTER_MAP: Record<EntityType, (id: string) => Promise<Record<string, unknown> | null>> = {
  project: (id) => getProject(id) as Promise<Record<string, unknown> | null>,
  prompt: (id) => getPrompt(id) as Promise<Record<string, unknown> | null>,
  conversation: (id) => getConversation(id) as Promise<Record<string, unknown> | null>,
  snippet: (id) => getSnippet(id) as Promise<Record<string, unknown> | null>,
  snippet_collection: (id) => getSnippetCollection(id) as Promise<Record<string, unknown> | null>,
};

// Fields that should not be overwritten during restore
const IMMUTABLE_FIELDS = ["id", "created_at"];

export function registerRestoreRoutes(app: FastifyInstance) {
  app.post("/restore/:event_id", async (req, reply) => {
    const { event_id } = req.params as { event_id: string };
    const body = (req.body ?? {}) as { force?: boolean };

    // 1. Fetch the activity log event
    const event = await getActivityLog(event_id);
    if (!event) {
      return reply.status(404).send({ error: "activity log event not found" });
    }

    // 2. Extract before_state (the state we want to restore to)
    const beforeState = event.metadata.before_state;
    if (!beforeState || typeof beforeState !== "object") {
      return reply.status(400).send({ error: "event has no before_state to restore" });
    }

    // 3. Validate entity still exists
    const entityType = event.entity_type;
    const entityId = event.entity_id;
    const getter = GETTER_MAP[entityType];
    const currentState = await getter(entityId);

    if (!currentState) {
      return reply.status(404).send({
        error: "entity not found",
        detail: `${entityType} ${entityId} has been deleted and cannot be restored`,
      });
    }

    // 4. Detect conflicting changes: compare current state vs the logged after_state
    //    If current !== after_state, the entity has been modified since this event
    const loggedAfterState = event.metadata.after_state;
    const conflicts: FieldDiff[] = loggedAfterState
      ? computeDiff(
          loggedAfterState as Record<string, unknown>,
          currentState,
        )
      : [];

    if (conflicts.length > 0 && !body.force) {
      return reply.status(409).send({
        error: "conflict",
        detail: "Entity has been modified since this event. Send force: true to override.",
        conflicts,
        event_id: event.id,
        entity_type: entityType,
        entity_id: entityId,
      });
    }

    // 5. Apply before_state as a mutation
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(beforeState)) {
      if (IMMUTABLE_FIELDS.includes(key)) continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length > 0) {
      const collectionName = COLLECTION_MAP[entityType];
      await db.collection(collectionName).doc(entityId).update(updates);
    }

    // 6. Fetch the entity after restore
    const afterState = await getter(entityId);

    // 7. Log action_type = restored
    await logActivity({
      project_id: event.project_id,
      entity_type: entityType,
      entity_id: entityId,
      action_type: "restored",
      metadata: {
        before_state: currentState,
        after_state: afterState as Record<string, unknown>,
        restored_from_event_id: event_id,
        forced: conflicts.length > 0,
      },
      actor: "user",
    });

    return {
      restored: true,
      entity_type: entityType,
      entity_id: entityId,
      restored_from_event: event_id,
      entity: afterState,
      forced: conflicts.length > 0,
    };
  });
}
