import { GoogleGenAI, type Content, type FunctionDeclaration, type Tool as GeminiTool } from "@google/genai";
import { LLMProvider, ChatMessage, StreamEvent, ToolDefinition } from "../provider";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async *stream(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<StreamEvent> {
    // Separate system message from conversation
    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Convert messages to Gemini format
    const contents: Content[] = [];
    for (const msg of conversationMessages) {
      if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          contents.push({
            role: "model",
            parts: msg.tool_calls.map((tc) => ({
              functionCall: {
                name: tc.name,
                args: JSON.parse(tc.arguments),
              },
            })),
          });
        } else {
          contents.push({ role: "model", parts: [{ text: msg.content || "" }] });
        }
      } else if (msg.role === "tool") {
        contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: msg.tool_call_id || "unknown",
              response: JSON.parse(msg.content),
            },
          }],
        });
      }
    }

    // Convert tool definitions to Gemini format
    let geminiTools: GeminiTool[] | undefined;
    if (tools && tools.length > 0) {
      const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as FunctionDeclaration["parameters"],
      }));
      geminiTools = [{ functionDeclarations }];
    }

    try {
      const response = await this.client.models.generateContentStream({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          tools: geminiTools,
        },
      });

      for await (const chunk of response) {
        if (!chunk.candidates || chunk.candidates.length === 0) continue;
        const candidate = chunk.candidates[0];
        if (!candidate.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            yield {
              type: "tool_call",
              tool_call: {
                id: (part.functionCall.name || "call") + "_" + Date.now(),
                name: part.functionCall.name || "unknown",
                arguments: JSON.stringify(part.functionCall.args || {}),
              },
            };
          } else if (part.text) {
            yield { type: "delta", content: part.text };
          }
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
