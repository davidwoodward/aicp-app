import { FastifyInstance } from "fastify";
import { loadLLMConfig, isValidProvider, ProviderName } from "../llm/config";
import { trackExecutionStarted, trackExecutionCompleted } from "../telemetry/telemetryService";
import { createProvider } from "../llm/index";
import { toolDefinitions } from "../llm/tools";
import { SYSTEM_PROMPT } from "../llm/system-prompt";
import { executeTool } from "../llm/tool-executor";
import { ChatMessage, ToolCall } from "../llm/provider";
import {
  createConversation,
  getConversation,
  updateConversation,
} from "../firestore/conversations";
import {
  createChatMessage,
  listChatMessagesByConversation,
} from "../firestore/chat-messages";

const MAX_TOOL_ITERATIONS = 10;

export function registerChatRoutes(app: FastifyInstance) {
  app.post("/chat", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const userMessage = body.message as string;

    if (!userMessage || typeof userMessage !== "string") {
      return reply.status(400).send({ error: "message is required" });
    }

    // Resolve provider & model
    const config = loadLLMConfig();
    let providerName: ProviderName = config.defaultProvider as ProviderName;
    if (body.provider && typeof body.provider === "string" && isValidProvider(body.provider)) {
      providerName = body.provider;
    }

    const providerConfig = config.providers[providerName];
    if (!providerConfig.configured) {
      return reply.status(400).send({ error: `Provider "${providerName}" is not configured` });
    }

    // Override model if provided
    const model = typeof body.model === "string" ? body.model : providerConfig.model;
    const effectiveConfig = { ...providerConfig, model };

    // Resolve or create conversation
    let conversationId = body.conversation_id as string | undefined;
    if (conversationId) {
      const existing = await getConversation(conversationId);
      if (!existing) {
        return reply.status(404).send({ error: "conversation not found" });
      }
    } else {
      const conversation = await createConversation({
        title: userMessage.slice(0, 100),
        model,
        provider: providerName,
      });
      conversationId = conversation.id;
    }

    // Save user message
    await createChatMessage({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // Build message history
    const history = await listChatMessagesByConversation(conversationId);
    const llmMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    for (const msg of history) {
      llmMessages.push({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
      });
    }

    // Set up SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationId,
    });

    function sendSSE(event: string, data: unknown) {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    sendSSE("conversation", { id: conversationId });

    const provider = createProvider(providerName, effectiveConfig);
    const telemetryExecId = trackExecutionStarted({
      agent_id: "chat",
      prompt_id: conversationId,
      session_id: conversationId,
      model,
      provider: providerName,
    });
    let iterations = 0;
    let fullContent = "";
    let allToolCalls: ToolCall[] = [];
    let totalUsage: { input_tokens?: number; output_tokens?: number } | undefined;

    try {
      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        let iterationContent = "";
        const iterationToolCalls: ToolCall[] = [];

        for await (const event of provider.stream(llmMessages, toolDefinitions)) {
          switch (event.type) {
            case "delta":
              iterationContent += event.content;
              sendSSE("delta", { content: event.content });
              break;
            case "tool_call":
              iterationToolCalls.push(event.tool_call);
              sendSSE("tool_call", {
                id: event.tool_call.id,
                name: event.tool_call.name,
                arguments: event.tool_call.arguments,
              });
              break;
            case "error":
              sendSSE("error", { error: event.error });
              reply.raw.end();
              return;
            case "done":
              if (event.usage) {
                totalUsage = {
                  input_tokens: (totalUsage?.input_tokens ?? 0) + (event.usage.input_tokens ?? 0),
                  output_tokens: (totalUsage?.output_tokens ?? 0) + (event.usage.output_tokens ?? 0),
                };
              }
              break;
          }
        }

        fullContent += iterationContent;

        // No tool calls — we're done
        if (iterationToolCalls.length === 0) {
          break;
        }

        allToolCalls = allToolCalls.concat(iterationToolCalls);

        // Add assistant message with tool calls to context
        llmMessages.push({
          role: "assistant",
          content: iterationContent,
          tool_calls: iterationToolCalls,
        });

        // Execute each tool call and add results
        for (const tc of iterationToolCalls) {
          const result = await executeTool(tc);
          sendSSE("tool_result", { tool_call_id: tc.id, name: tc.name, result });

          llmMessages.push({
            role: "tool",
            content: result,
            tool_call_id: tc.id,
          });
        }

        // Loop to let the LLM continue after tool results
      }

      // Save assistant message to Firestore
      await createChatMessage({
        conversation_id: conversationId,
        role: "assistant",
        content: fullContent,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
      });

      // Update conversation timestamp
      await updateConversation(conversationId, {});

      trackExecutionCompleted(telemetryExecId, totalUsage);
      sendSSE("done", { conversation_id: conversationId });
    } catch (err) {
      sendSSE("error", { error: err instanceof Error ? err.message : "Internal error" });
    } finally {
      reply.raw.end();
    }
  });
}
