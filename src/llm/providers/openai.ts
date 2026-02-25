import OpenAI from "openai";
import {
  LLMProvider,
  ChatMessage,
  StreamEvent,
  ToolDefinition,
  ToolCall,
} from "../provider";

type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OAITool = OpenAI.Chat.Completions.ChatCompletionTool;

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async *stream(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<StreamEvent> {
    // Convert messages to OpenAI format
    const oaiMessages: OAIMessage[] = messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id || "",
        };
      }
      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "assistant" as const,
          content: msg.content || null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });

    // Convert tool definitions
    let oaiTools: OAITool[] | undefined;
    if (tools && tools.length > 0) {
      oaiTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: oaiMessages,
        tools: oaiTools,
        stream: true,
      });

      // Accumulate tool calls across deltas
      const pendingToolCalls = new Map<number, ToolCall>();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          yield { type: "delta", content: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            let pending = pendingToolCalls.get(idx);
            if (!pending) {
              pending = { id: tc.id || "", name: tc.function?.name || "", arguments: "" };
              pendingToolCalls.set(idx, pending);
            }
            if (tc.id) pending.id = tc.id;
            if (tc.function?.name) pending.name = tc.function.name;
            if (tc.function?.arguments) pending.arguments += tc.function.arguments;
          }
        }

        // Check if this chunk signals the end
        if (chunk.choices[0]?.finish_reason === "tool_calls") {
          for (const [, tc] of pendingToolCalls) {
            yield { type: "tool_call", tool_call: { ...tc } };
          }
          pendingToolCalls.clear();
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
