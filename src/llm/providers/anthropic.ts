import Anthropic from "@anthropic-ai/sdk";
import {
  LLMProvider,
  ChatMessage,
  StreamEvent,
  ToolDefinition,
  ToolCall,
} from "../provider";

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicTool = Anthropic.Tool;

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *stream(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<StreamEvent> {
    // Extract system message (Anthropic takes it as a separate param)
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Convert messages to Anthropic format
    const anthropicMessages: AnthropicMessage[] = [];
    for (const msg of conversationMessages) {
      if (msg.role === "user") {
        anthropicMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const content: Anthropic.ContentBlockParam[] = [];
          if (msg.content) {
            content.push({ type: "text", text: msg.content });
          }
          for (const tc of msg.tool_calls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: JSON.parse(tc.arguments),
            });
          }
          anthropicMessages.push({ role: "assistant", content });
        } else {
          anthropicMessages.push({ role: "assistant", content: msg.content });
        }
      } else if (msg.role === "tool") {
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id || "",
              content: msg.content,
            },
          ],
        });
      }
    }

    // Convert tool definitions
    let anthropicTools: AnthropicTool[] | undefined;
    if (tools && tools.length > 0) {
      anthropicTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool["input_schema"],
      }));
    }

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: systemMsg || undefined,
        messages: anthropicMessages,
        tools: anthropicTools,
      });

      let currentToolCall: Partial<ToolCall> | null = null;

      for await (const event of stream) {
        switch (event.type) {
          case "content_block_start": {
            const block = event.content_block;
            if (block.type === "tool_use") {
              currentToolCall = {
                id: block.id,
                name: block.name,
                arguments: "",
              };
            }
            break;
          }
          case "content_block_delta": {
            const delta = event.delta;
            if (delta.type === "text_delta") {
              yield { type: "delta", content: delta.text };
            } else if (delta.type === "input_json_delta" && currentToolCall) {
              currentToolCall.arguments = (currentToolCall.arguments || "") + delta.partial_json;
            }
            break;
          }
          case "content_block_stop": {
            if (currentToolCall && currentToolCall.id && currentToolCall.name) {
              yield {
                type: "tool_call",
                tool_call: {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: currentToolCall.arguments || "{}",
                },
              };
              currentToolCall = null;
            }
            break;
          }
          case "message_delta": {
            // Message is ending
            break;
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: "done",
        usage: {
          input_tokens: finalMessage.usage.input_tokens,
          output_tokens: finalMessage.usage.output_tokens,
        },
      };
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
