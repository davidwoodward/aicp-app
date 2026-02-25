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

export async function executeTool(toolCall: ToolCall): Promise<string> {
  const args = JSON.parse(toolCall.arguments);

  switch (toolCall.name) {
    case "list_projects": {
      const projects = await listProjects();
      return JSON.stringify(projects);
    }

    case "create_project": {
      const project = await createProject({
        name: args.name,
        description: args.description,
      });
      return JSON.stringify(project);
    }

    case "add_prompt": {
      const prompt = await createPrompt({
        project_id: args.project_id,
        title: args.title,
        body: args.body,
        order_index: args.order_index,
        parent_prompt_id: args.parent_prompt_id || null,
      });
      return JSON.stringify(prompt);
    }

    case "list_snippets": {
      const snippets = await listSnippets(args.collection_id || undefined);
      return JSON.stringify(snippets);
    }

    case "create_snippet": {
      const snippet = await createSnippet({
        name: args.name,
        content: args.content,
        collection_id: args.collection_id || null,
      });
      return JSON.stringify(snippet);
    }

    case "list_snippet_collections": {
      const collections = await listSnippetCollections();
      return JSON.stringify(collections);
    }

    case "create_snippet_collection": {
      const collection = await createSnippetCollection({
        name: args.name,
        description: args.description || "",
      });
      return JSON.stringify(collection);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
  }
}
