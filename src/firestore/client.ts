import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.FIRESTORE_PROJECT_ID;
if (!projectId) {
  throw new Error("FIRESTORE_PROJECT_ID environment variable is required");
}

export const db = new Firestore({ projectId });
