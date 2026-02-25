import { db } from "./client";

const collection = db.collection("chat_messages");

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
  tool_call_id?: string;
  timestamp: string;
}

export async function createChatMessage(
  data: Omit<ChatMessageRecord, "id" | "timestamp">
): Promise<ChatMessageRecord> {
  const doc = collection.doc();
  const message: ChatMessageRecord = {
    id: doc.id,
    ...data,
    timestamp: new Date().toISOString(),
  };
  await doc.set(message);
  return message;
}

export async function listChatMessagesByConversation(
  conversationId: string
): Promise<ChatMessageRecord[]> {
  const snapshot = await collection
    .where("conversation_id", "==", conversationId)
    .orderBy("timestamp", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as ChatMessageRecord);
}

export async function deleteChatMessagesByConversation(
  conversationId: string
): Promise<void> {
  const snapshot = await collection
    .where("conversation_id", "==", conversationId)
    .get();
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}
