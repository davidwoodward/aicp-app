import { db } from "./client";

const collection = db.collection("messages");

export type MessageRole = "user" | "claude";

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export async function createMessage(
  data: Omit<Message, "id" | "timestamp">
): Promise<Message> {
  const doc = collection.doc();
  const message: Message = {
    id: doc.id,
    ...data,
    timestamp: new Date().toISOString(),
  };
  await doc.set(message);
  return message;
}

export async function getMessage(id: string): Promise<Message | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Message;
}

export async function listMessagesBySession(sessionId: string): Promise<Message[]> {
  const snapshot = await collection
    .where("session_id", "==", sessionId)
    .orderBy("timestamp", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Message);
}

export async function deleteMessage(id: string): Promise<void> {
  await collection.doc(id).delete();
}
