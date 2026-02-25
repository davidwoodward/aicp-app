import { ToolDefinition } from "./provider";

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "list_projects",
    description: "List all projects. Returns an array of projects with id, name, description, and created_at.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_project",
    description: "Create a new project. Requires a name and description.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The project name" },
        description: { type: "string", description: "A short description of the project" },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "add_prompt",
    description: "Add a prompt to a project. Requires project_id, title, body, and order_index. Optionally set parent_prompt_id for nesting.",
    parameters: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "The project ID to add the prompt to" },
        title: { type: "string", description: "Short title for the prompt" },
        body: { type: "string", description: "The full prompt text" },
        order_index: { type: "number", description: "Position in the list (0-based)" },
        parent_prompt_id: { type: "string", description: "Parent prompt ID for nesting (optional)" },
      },
      required: ["project_id", "title", "body", "order_index"],
    },
  },
  {
    name: "list_snippets",
    description: "List all snippets. Optionally filter by collection_id.",
    parameters: {
      type: "object",
      properties: {
        collection_id: { type: "string", description: "Filter by collection ID (optional)" },
      },
      required: [],
    },
  },
  {
    name: "create_snippet",
    description: "Create a reusable text snippet. Optionally assign it to a collection.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short name for the snippet" },
        content: { type: "string", description: "The snippet content" },
        collection_id: { type: "string", description: "Collection ID to assign to (optional)" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "list_snippet_collections",
    description: "List all snippet collections.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_snippet_collection",
    description: "Create a new snippet collection for organizing snippets.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Collection name" },
        description: { type: "string", description: "What this collection is for" },
      },
      required: ["name"],
    },
  },
];
