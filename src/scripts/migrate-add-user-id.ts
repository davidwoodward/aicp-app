/**
 * One-time migration script to add user_id and tenant_id to all existing documents.
 *
 * Usage: npx ts-node src/scripts/migrate-add-user-id.ts <user_id>
 *
 * The user_id should be the Google `sub` claim of the primary user (dawoodward@gmail.com).
 * Run this after the first login to get the actual sub value, or pass a placeholder.
 */

import "../firestore/client";
import { db } from "../firestore/client";

const COLLECTIONS = [
  "projects",
  "prompts",
  "conversations",
  "snippets",
  "snippet_collections",
  "agents",
  "sessions",
  "activity_logs",
];

async function migrate(userId: string) {
  console.log(`Migrating all documents to user_id=${userId}, tenant_id=${userId}`);

  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) {
      console.log(`  ${collectionName}: 0 documents (skipped)`);
      continue;
    }

    const batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.user_id) {
        batch.update(doc.ref, {
          user_id: userId,
          tenant_id: userId,
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    console.log(`  ${collectionName}: ${count}/${snapshot.size} documents updated`);
  }

  console.log("Migration complete.");
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npx ts-node src/scripts/migrate-add-user-id.ts <user_id>");
  console.error("  user_id: Google sub claim of the primary user");
  process.exit(1);
}

migrate(userId).catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
