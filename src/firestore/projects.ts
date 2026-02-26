import { db } from "./client";

const collection = db.collection("projects");

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  deleted_at: string | null;
}

export async function createProject(data: Omit<Project, "id" | "created_at" | "deleted_at">): Promise<Project> {
  const doc = collection.doc();
  const project: Project = {
    id: doc.id,
    ...data,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
  await doc.set(project);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  const doc = await collection.doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Project;
}

export async function listProjects(): Promise<Project[]> {
  const snapshot = await collection.orderBy("created_at", "desc").get();
  return snapshot.docs
    .map((doc) => doc.data() as Project)
    .filter((p) => !p.deleted_at);
}

export async function listDeletedProjects(): Promise<Project[]> {
  const snapshot = await collection.orderBy("created_at", "desc").get();
  return snapshot.docs
    .map((doc) => doc.data() as Project)
    .filter((p) => !!p.deleted_at)
    .sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!));
}

export async function updateProject(id: string, data: Partial<Pick<Project, "name" | "description">>): Promise<void> {
  await collection.doc(id).update(data);
}

export async function softDeleteProject(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: new Date().toISOString() });
}

export async function restoreProject(id: string): Promise<void> {
  await collection.doc(id).update({ deleted_at: null });
}
