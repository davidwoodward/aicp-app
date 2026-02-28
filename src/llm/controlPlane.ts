import { loadLLMConfig, loadUserLLMConfig, isValidProvider, ProviderName, type UserLLMKeys } from "./config";
import { createProvider } from "./index";
import { ChatMessage } from "./provider";

export interface ControlPlaneResult {
  action: string;
  payload: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are an intent parser. Given a user's natural language input, return ONLY a JSON object with "action" and "payload" fields. No explanation, no markdown, no extra text — just the JSON.

Supported actions:
- "create_project" — payload: { "name": string, "description": string }
- "add_prompt" — payload: { "project_id": string, "title": string, "body": string }
- "create_snippet" — payload: { "name": string, "content": string }
- "list_snippets" — payload: {}
- "list_snippet_collections" — payload: {}
- "list_projects" — payload: {}
- "unknown" — payload: { "reason": string }

Rules:
- If the user says "create project X", infer a reasonable description if none given.
- For "add prompt", the body IS the prompt text the user provided. Do NOT rewrite or mutate it.
- If the intent is unclear, return action "unknown" with a reason.
- NEVER return anything except the JSON object.`;

function getControlPlaneConfig(userKeys?: UserLLMKeys): { provider: ProviderName; model: string } {
  const config = userKeys ? loadUserLLMConfig(userKeys) : loadLLMConfig();

  const providerEnv = process.env.CONTROL_PLANE_PROVIDER || "";
  const modelEnv = process.env.CONTROL_PLANE_MODEL || "";

  let provider: ProviderName;
  if (providerEnv && isValidProvider(providerEnv) && config.providers[providerEnv].configured) {
    provider = providerEnv;
  } else {
    provider = config.defaultProvider as ProviderName;
  }

  const model = modelEnv || config.providers[provider].model;
  return { provider, model };
}

export async function interpret(userInput: string, userKeys?: UserLLMKeys): Promise<ControlPlaneResult> {
  const { provider: providerName, model } = getControlPlaneConfig(userKeys);
  const config = userKeys ? loadUserLLMConfig(userKeys) : loadLLMConfig();
  const providerConfig = { ...config.providers[providerName], model };

  if (!providerConfig.configured) {
    throw new Error(`Control plane provider "${providerName}" is not configured`);
  }

  const provider = createProvider(providerName, providerConfig);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ];

  // Collect the full response (no tools — we just want text back)
  let response = "";
  for await (const event of provider.stream(messages)) {
    if (event.type === "delta") {
      response += event.content;
    } else if (event.type === "error") {
      throw new Error(`Control plane LLM error: ${event.error}`);
    }
  }

  // Parse JSON from response
  const trimmed = response.trim();
  // Handle possible markdown code fences
  const jsonStr = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : trimmed;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.action || typeof parsed.action !== "string") {
      return { action: "unknown", payload: { reason: "LLM returned invalid structure" } };
    }
    return {
      action: parsed.action,
      payload: parsed.payload ?? {},
    };
  } catch {
    return { action: "unknown", payload: { reason: "Failed to parse LLM response", raw: jsonStr } };
  }
}
