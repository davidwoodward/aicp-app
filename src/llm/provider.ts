// Unified LLM provider interface and types

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "tool_call"; tool_call: ToolCall }
  | { type: "done"; usage?: { input_tokens?: number; output_tokens?: number } }
  | { type: "error"; error: string };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMProvider {
  stream(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncIterable<StreamEvent>;
}
