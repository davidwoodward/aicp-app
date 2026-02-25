import { FastifyInstance } from "fastify";
import { getActivityLog, logActivity, EntityType } from "../middleware/activityLogger";
import { db } from "../firestore/client";
import { getProject } from "../firestore/projects";
import { getPrompt } from "../firestore/prompts";
import { getConversation } from "../firestore/conversations";
import { getSnippet } from "../firestore/snippets";
import { getSnippetCollection } from "../firestore/snippet-collections";

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

    // 1. Fetch the activity log event
    const event = await getActivityLog(event_id);
    if (!event) {
      return reply.status(404).send({ error: "activity log event not found" });
    }

    // 2. Extract before_state
    const beforeState = event.metadata.before_state;
    if (!beforeState || typeof beforeState !== "object") {
      return reply.status(400).send({ error: "event has no before_state to restore" });
    }

    // 3. Verify entity still exists (can't restore into a deleted doc that's gone)
    const entityType = event.entity_type;
    const entityId = event.entity_id;
    const getter = GETTER_MAP[entityType];
    const currentState = await getter(entityId);

    if (!currentState) {
      // Entity was deleted — re-create it from before_state
      const collectionName = COLLECTION_MAP[entityType];
      await db.collection(collectionName).doc(entityId).set(beforeState);
    } else {
      // Entity exists — apply before_state fields as an update
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(beforeState)) {
        if (IMMUTABLE_FIELDS.includes(key)) continue;
        updates[key] = value;
      }

      if (Object.keys(updates).length > 0) {
        const collectionName = COLLECTION_MAP[entityType];
        await db.collection(collectionName).doc(entityId).update(updates);
      }
    }

    // 4. Fetch the entity after restore
    const afterState = await getter(entityId);

    // 5. Write new append-only log entry
    await logActivity({
      project_id: event.project_id,
      entity_type: entityType,
      entity_id: entityId,
      action_type: "restored",
      metadata: {
        before_state: currentState || null,
        after_state: afterState as Record<string, unknown>,
        restored_from_event_id: event_id,
      },
      actor: "user",
    });

    return {
      restored: true,
      entity_type: entityType,
      entity_id: entityId,
      restored_from_event: event_id,
      entity: afterState,
    };
  });
}
