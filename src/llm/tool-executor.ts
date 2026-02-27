import { ToolCall } from "./provider";
import { createProject, listProjects } from "../firestore/projects";
import { createPrompt } from "../firestore/prompts";
import {
  createSnippet,
  listSnippets,
} from "../firestore/snippets";
import {
  createSnippetCollection,
  listSnippetCollections,
} from "../firestore/snippet-collections";

export interface ToolUserContext {
  user_id: string;
  tenant_id: string;
}

export async function executeTool(toolCall: ToolCall, userCtx?: ToolUserContext): Promise<string> {
  const args = JSON.parse(toolCall.arguments);
  const uid = userCtx?.user_id || "system";
  const tid = userCtx?.tenant_id || uid;

  switch (toolCall.name) {
    case "list_projects": {
      const projects = await listProjects(uid);
      return JSON.stringify(projects);
    }

    case "create_project": {
      const project = await createProject({
        user_id: uid,
        tenant_id: tid,
        name: args.name,
        description: args.description,
      });
      return JSON.stringify(project);
    }

    case "add_prompt": {
      const prompt = await createPrompt({
        user_id: uid,
        tenant_id: tid,
        project_id: args.project_id,
        title: args.title,
        body: args.body,
        order_index: args.order_index,
        parent_prompt_id: args.parent_prompt_id || null,
      });
      return JSON.stringify(prompt);
    }

    case "list_snippets": {
      const snippets = await listSnippets(uid);
      return JSON.stringify(snippets);
    }

    case "create_snippet": {
      const snippet = await createSnippet({
        user_id: uid,
        tenant_id: tid,
        name: args.name,
        content: args.content,
      });
      return JSON.stringify(snippet);
    }

    case "list_snippet_collections": {
      const collections = await listSnippetCollections(uid);
      return JSON.stringify(collections);
    }

    case "create_snippet_collection": {
      const collection = await createSnippetCollection({
        user_id: uid,
        tenant_id: tid,
        name: args.name,
        description: args.description || "",
      });
      return JSON.stringify(collection);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
  }
}
