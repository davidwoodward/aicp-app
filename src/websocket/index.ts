import { FastifyInstance } from "fastify";
import {
  registerAgent,
  removeBySocket,
  setAgentStatus,
} from "./agentRegistry";
import {
  createAgent,
  getAgent,
  updateAgentStatus,
  updateHeartbeat,
  AgentStatus,
} from "../firestore/agents";
import { getProject } from "../firestore/projects";
import { createMessage, MessageRole } from "../firestore/messages";
import { updatePromptStatus } from "../firestore/prompts";
import { endSession } from "../firestore/sessions";
import {
  addUIClient,
  trackAgentConnected,
  trackAgentDisconnected,
  trackAgentStatus,
  trackExecutionStarted,
  trackExecutionCompleted,
  findExecutionBySession,
} from "../telemetry/telemetryService";

interface RegisterMsg {
  type: "register";
  agent_id: string;
  project_id: string;
  machine_name: string;
}

interface HeartbeatMsg {
  type: "heartbeat";
}

interface StatusMsg {
  type: "status";
  status: AgentStatus;
}

interface MessageMsg {
  type: "message";
  session_id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

interface ExecutionCompleteMsg {
  type: "execution_complete";
  prompt_id: string;
  session_id: string;
  token_usage?: { input_tokens?: number; output_tokens?: number };
}

type AgentMessage = RegisterMsg | HeartbeatMsg | StatusMsg | MessageMsg | ExecutionCompleteMsg;

const VALID_STATUSES: AgentStatus[] = ["idle", "busy", "offline"];
const VALID_ROLES: MessageRole[] = ["user", "claude"];

export function registerWebSocket(app: FastifyInstance) {
  // Agent communication channel
  app.get("/ws", { websocket: true }, (socket) => {
    let agentId: string | null = null;

    socket.on("message", async (data: Buffer) => {
      let msg: AgentMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        socket.send(JSON.stringify({ type: "error", error: "invalid JSON" }));
        return;
      }

      if (!msg.type) {
        socket.send(JSON.stringify({ type: "error", error: "missing type field" }));
        return;
      }

      // Must register before any other message type
      if (msg.type !== "register" && !agentId) {
        socket.send(JSON.stringify({ type: "error", error: "must register first" }));
        return;
      }

      try {
        switch (msg.type) {
          case "register": {
            if (!msg.agent_id || !msg.project_id || !msg.machine_name) {
              socket.send(JSON.stringify({ type: "error", error: "register requires agent_id, project_id, machine_name" }));
              return;
            }

            // Validate project exists before allowing registration
            const project = await getProject(msg.project_id);
            if (!project) {
              socket.send(JSON.stringify({ type: "error", error: `project ${msg.project_id} not found` }));
              return;
            }

            // Upsert agent in Firestore
            const existing = await getAgent(msg.agent_id);
            if (!existing) {
              await createAgent({
                project_id: msg.project_id,
                machine_name: msg.machine_name,
                tool_type: "claude_code",
              });
            }

            // Register in-memory (closes previous socket if exists)
            registerAgent(msg.agent_id, msg.project_id, socket);
            agentId = msg.agent_id;

            await updateAgentStatus(msg.agent_id, "idle");
            trackAgentConnected(msg.agent_id, msg.project_id);
            app.log.info({ agent_id: msg.agent_id, project_id: msg.project_id }, "Agent registered");
            socket.send(JSON.stringify({ type: "registered", agent_id: msg.agent_id }));
            break;
          }

          case "heartbeat": {
            await updateHeartbeat(agentId!);
            socket.send(JSON.stringify({ type: "heartbeat_ack" }));
            break;
          }

          case "status": {
            if (!msg.status || !VALID_STATUSES.includes(msg.status)) {
              socket.send(JSON.stringify({ type: "error", error: `status must be one of: ${VALID_STATUSES.join(", ")}` }));
              return;
            }
            setAgentStatus(agentId!, msg.status);
            await updateAgentStatus(agentId!, msg.status);
            trackAgentStatus(agentId!, msg.status);
            app.log.info({ agent_id: agentId, status: msg.status }, "Agent status updated");
            break;
          }

          case "message": {
            if (!msg.session_id || !msg.role || !msg.content) {
              socket.send(JSON.stringify({ type: "error", error: "message requires session_id, role, content" }));
              return;
            }
            if (!VALID_ROLES.includes(msg.role)) {
              socket.send(JSON.stringify({ type: "error", error: `role must be one of: ${VALID_ROLES.join(", ")}` }));
              return;
            }
            await createMessage({
              session_id: msg.session_id,
              role: msg.role,
              content: msg.content,
            });
            break;
          }

          case "execution_complete": {
            if (!msg.prompt_id || !msg.session_id) {
              socket.send(JSON.stringify({ type: "error", error: "execution_complete requires prompt_id, session_id" }));
              return;
            }
            await updatePromptStatus(msg.prompt_id, "done");
            await endSession(msg.session_id);
            setAgentStatus(agentId!, "idle");
            await updateAgentStatus(agentId!, "idle");

            // Complete telemetry tracking
            const execId = findExecutionBySession(msg.session_id);
            if (execId) {
              trackExecutionCompleted(execId, msg.token_usage);
            }
            trackAgentStatus(agentId!, "idle");

            app.log.info({ agent_id: agentId, prompt_id: msg.prompt_id, session_id: msg.session_id }, "Execution complete");
            break;
          }

          default: {
            socket.send(JSON.stringify({ type: "error", error: `unknown message type: ${(msg as Record<string, unknown>).type}` }));
          }
        }
      } catch (err) {
        app.log.error({ err, agent_id: agentId }, "Error handling WebSocket message");
        socket.send(JSON.stringify({ type: "error", error: "internal error" }));
      }
    });

    socket.on("close", async () => {
      const removedId = removeBySocket(socket);
      if (removedId) {
        try {
          await updateAgentStatus(removedId, "offline");
        } catch (err) {
          app.log.error({ err, agent_id: removedId }, "Error setting agent offline");
        }
        trackAgentDisconnected(removedId);
        app.log.info({ agent_id: removedId }, "Agent disconnected");
      }
    });
  });

  // Telemetry broadcast channel for UI clients (project-scoped)
  app.get("/ws/telemetry", { websocket: true }, async (socket, request) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const projectId = url.searchParams.get("project_id");

    if (!projectId) {
      socket.send(JSON.stringify({ type: "error", error: "project_id query parameter is required" }));
      socket.close(1008, "project_id required");
      return;
    }

    // Validate project exists
    const project = await getProject(projectId);
    if (!project) {
      socket.send(JSON.stringify({ type: "error", error: `project ${projectId} not found` }));
      socket.close(1008, "invalid project_id");
      return;
    }

    addUIClient(socket, projectId);
  });
}
