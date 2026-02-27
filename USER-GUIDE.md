# AICP User Guide

**AI Conductor Platform** --- Structure, store, and sequence your thinking. Execute prompts against connected Claude Code agents from a single control surface.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Overview](#overview)
3. [Getting Started](#getting-started)
4. [The Interface](#the-interface)
5. [Projects](#projects)
6. [Prompts](#prompts)
7. [Snippets](#snippets)
8. [Executing Prompts on Agents](#executing-prompts-on-agents)
9. [LLM Chat](#llm-chat)
10. [Refine](#refine)
11. [Tomorrow Morning Mode](#tomorrow-morning-mode)
12. [Settings](#settings)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Command Palette](#command-palette)
15. [Activity & History](#activity--history)
16. [Telemetry Panel](#telemetry-panel)
17. [Connecting an Agent (CCA)](#connecting-an-agent-cca)
18. [API Reference](#api-reference)
19. [Deployment](#deployment)
20. [Configuration](#configuration)
21. [Troubleshooting](#troubleshooting)

---

## Philosophy

> This system exists because my thoughts outrun Claude.

AICP is not a multi-agent AI platform. It is not a SaaS product. It is a tool for **structuring, storing, and sequencing human thinking** in a disciplined and controllable way.

The core workflow: you think, you write prompts, you refine them, you execute them against Claude Code. AICP separates the **orchestration and memory layer** (cloud) from the **execution layer** (local Claude Code). Claude remains the execution engine. AICP is the cognitive control layer.

The system is composed of two parts:
- **Claude Code Orchestrator (CCO)** --- the web application (`aicp-app`). Manages projects, prompts, snippets, execution dispatch, and UI.
- **Claude Conductor Agent (CCA)** --- the local CLI agent (`aicp-claude-agent`). Wraps Claude Code, connects to CCO via WebSocket, receives prompts, and streams execution results back.

---

## Overview

AICP is a web application for orchestrating AI-powered development workflows. It provides:

- **Projects** to organize work.
- **Prompts** arranged in a tree hierarchy, each with a lifecycle status (draft, ready, sent, done).
- **Snippets** for reusable text blocks that can be inserted into prompts.
- **Agent execution** --- send prompts to connected Claude Code agents via WebSocket and monitor results in real time.
- **LLM Chat** --- converse with an LLM assistant that can create projects, prompts, and snippets on your behalf.
- **Refine** --- use an LLM to improve prompt text before sending it to an agent.

AICP is composed of three repositories:

| Repository | Purpose |
|---|---|
| `aicp-app` | Web application (Fastify backend + React frontend) |
| `aicp-infra` | Terraform infrastructure (GCP: Cloud Run, Firestore, IAM) |
| `aicp-claude-agent` | CLI agent that wraps Claude Code and connects to AICP via WebSocket |

---

## Getting Started

### Prerequisites

- Node.js 22+
- A GCP project with Firestore in Native mode (or the Firestore emulator for local dev)
- At least one LLM API key (Gemini, OpenAI, or Anthropic)

### Install & Run Locally

```bash
# Clone and install
git clone <repo-url> && cd aicp-app
npm install

# Create a .env file (see Configuration section for all variables)
cp .env.example .env
# Edit .env with your API keys and Firestore project ID

# Start the dev server (backend + frontend)
npm run dev
```

The app starts on `http://localhost:8080`. The backend serves the API under `/api` and the frontend as static files.

---

## The Interface

AICP uses a **three-panel layout** with resizable panels:

```
┌──────────────────────────────────────────────────────────┐
│  TopBar  [Prompts] [Projects]     🔍  🗑  ⚙  🌓        │
├────────────┬──────────────────────────┬──────────────────┤
│            │                          │                  │
│  NavPanel  │     Center Panel         │  Telemetry Panel │
│ (resizable)│  (prompts / editor /     │  (resizable)     │
│            │   settings / snippets)   │                  │
│  Projects  │                          │  Connected       │
│  > Prompts │                          │  Agents          │
│            │                          │  — or —          │
│  Snippets  │                          │  History Panel   │
│            │                          │                  │
│            │                          │  Model Selector  │
│            │                          │  Refine Mode     │
└────────────┴──────────────────────────┴──────────────────┘
```

The left and right panels can be resized by dragging the divider handles between them. Panel widths are persisted in localStorage across sessions.

### TopBar

- **Prompts** / **Projects** --- switch between the main prompt view and the project management view. The active tab is highlighted in accent color.
- **Search icon** --- open the Command Palette (Cmd+K / Ctrl+K).
- **Trash icon** --- open the Recently Deleted panel to restore archived items.
- **Gear icon** --- open the Settings editor.
- **Theme toggle** --- switch between dark and light mode.

### NavPanel (Left)

- **Projects section** --- lists all projects. Click to expand and see nested prompts. Click "+" to navigate to the project management page.
- **Project actions menu** --- hover over a project name to reveal a three-dot (`...`) menu with options including **History** (view all edit history across the project) and **Delete**.
- **Prompt status dots** --- each prompt in the tree shows a colored dot indicating its status (draft, ready, sent, done).
- **Snippets section** --- lists all snippets. Click "+" to instantly create a new snippet and open it in the editor. Click the three-dot menu to open the Snippet Management panel.
- **Collections** --- groups of snippets displayed below individual snippets.

### Center Panel

Displays the active content based on context:
- A **prompt card** when a prompt is selected from the NavPanel.
- The **Snippet Editor** when a snippet is selected.
- The **Settings Editor** when opened from the TopBar.
- The **Chat view** with prompt list and input when nothing specific is selected.

### Telemetry Panel (Right)

- Shows **connected agents** for the selected project with live status updates.
- **History Panel** --- when history is opened (from a prompt's History button or a project's `...` menu), the history panel replaces the agents list in this sidebar. Dismiss to return to the agents view.
- **Model selector** for choosing the LLM provider and model.
- **Refine mode toggle** (Manual / Auto).

---

## Projects

Projects are the top-level organizational unit. Each project contains a tree of prompts.

### Create a Project

1. Click **Projects** in the TopBar.
2. Click **+ New Project**.
3. Enter a name and description.
4. Click **Create**.

### Edit a Project

1. Navigate to **Projects** in the TopBar.
2. Click a project row to open its detail page.
3. Edit the name or description inline.

### Delete a Project

AICP uses a **soft-delete** pattern:

1. Hover over a project in the NavPanel and click the three-dot menu, then **Delete Project**.
2. Confirm in the modal. The project is archived (soft-deleted).
3. To **restore**: open the Recently Deleted panel (trash icon in TopBar) and click Restore.
4. To **permanently delete**: archive first, then use the permanent delete option.

### Project Detail View

When you click a project in the Projects page, you see four tabs:

| Tab | Description |
|---|---|
| **Prompts** | Tree view of all prompts with drag-drop reordering and status badges |
| **Task List** | Task-oriented view of prompts |
| **History** | Historical execution sessions |
| **Activity** | Audit log of all actions on this project |

---

## Prompts

Prompts are the core content unit. They have a **title**, **body**, and a **status** that tracks their lifecycle.

### Prompt Status Lifecycle

```
draft  →  ready  →  sent  →  done
  │                          │
  └──── (can reset back) ────┘
```

| Status | Meaning |
|---|---|
| **draft** | Initial state. Prompt is being written or refined. |
| **ready** | Prompt is finalized and can be executed on an agent. |
| **sent** | Prompt has been dispatched to a connected agent. |
| **done** | Agent has completed execution. |

### Create a Prompt

**From the Prompt Tree (Projects view):**
1. Open a project and go to the **Prompts** tab.
2. Click **+ Root Prompt** to create a top-level prompt.
3. Hover over any prompt and click **+child** to create a nested child prompt.

**From the Chat view:**
1. Type `/new` in the chat input to create an untitled prompt in the current project.

### Edit a Prompt

Click a prompt in the NavPanel to open its **Prompt Card** in the center panel. The card supports:

- **Title editing** --- click the title field (in edit mode) to modify.
- **Body editing** --- click the body textarea to write or modify content.
- **Auto-save** --- changes are saved automatically after 800ms of inactivity without creating a history entry. A "Saving..." / "Saved" indicator appears in the header.
- **History snapshots** --- after a configurable period of inactivity (default 20 seconds), a history snapshot is saved that captures the before/after state. This delay is configurable in Settings.
- **Manual save** --- click the **Save** button to save immediately (creates a history entry).
- **Escape** --- press Escape to flush pending saves, create a history snapshot if content changed, and close the card.

### Prompt Card Features

| Feature | Description |
|---|---|
| **Status dropdown** | Click the status badge to change between draft, ready, sent, done |
| **Copy icon** | Copies the prompt body (content only, not title) to clipboard |
| **More.../Less...** | Long prompts are truncated (configurable line count); click to expand or collapse |
| **Save** | Manually save current edits (creates a history entry) |
| **Execute** | Send the prompt to a connected idle agent |
| **Refine** | Use an LLM to improve the prompt text |
| **History** | View edit history for this specific prompt in the right sidebar |
| **Insert Snippet** | Insert a reusable snippet into the prompt body |

### Reorder Prompts

In the **Prompt Tree** view or the NavPanel, drag and drop prompts to reorder them. You can also drag a prompt onto another to make it a child (nesting).

### Delete & Restore Prompts

- **Archive**: hover over a prompt in the tree and click the trash icon. Confirm with "Yes".
- **Restore**: switch to the "archived" filter in the Prompt Tree, then click the restore icon.
- **Permanent delete**: only available for already-archived prompts.

---

## Snippets

Snippets are reusable text blocks that can be inserted into prompts.

### Create a Snippet

1. In the NavPanel under **Snippets**, click **+**.
2. A new empty snippet opens immediately in the Snippet Editor.
3. Start typing content. The name field is at the top.
4. **Auto-title**: if you leave the name empty and close the editor, a title is automatically generated from the first line of content (up to ~35 characters at a word boundary). If the snippet is empty, it gets titled "Untitled".

### Edit a Snippet

Click any snippet in the NavPanel to open it in the center panel. The editor has:

- **Name field** at the top (with visible border/background).
- **Content textarea** for the snippet body.
- **Auto-save** with debounce (500ms).
- **Back arrow** or **Escape** to close and return.

### Insert a Snippet into a Prompt

1. Open a prompt card.
2. Click **Insert Snippet** in the action bar.
3. Browse or search snippets in the modal.
4. Click a snippet to insert it. The content is appended to the prompt body, separated by a horizontal rule (`---`).

### Snippet Collections

Collections group related snippets together.

1. Click the three-dot menu next to "Snippets" in the NavPanel to open the **Snippet Management Panel**.
2. Switch to the **Collections** tab.
3. Create collections and assign snippets to them.
4. Collections appear in the NavPanel below individual snippets. Click to expand and see member snippets.

### Delete & Restore Snippets

Same soft-delete pattern as projects and prompts: archive first, then restore or permanently delete.

---

## Executing Prompts on Agents

AICP can send prompts to connected **Claude Code agents** for execution.

### Prerequisites

- At least one `aicp-claude-agent` instance must be running and connected via WebSocket.
- The agent must be registered to the same project as the prompt.
- The prompt status must be **ready**.
- The agent status must be **idle**.

### Execute a Prompt

1. Set the prompt status to **ready** using the status dropdown.
2. Click **Execute** on the prompt card.
3. AICP selects the first idle agent and sends the prompt text.
4. The prompt status changes to **sent**.
5. Monitor progress in the Telemetry Panel (right sidebar) --- the agent status changes to **busy**.
6. When the agent completes, the prompt status changes to **done**.

### Error Messages

| Error | Meaning |
|---|---|
| "No agents connected" | No agents are registered for this project. Start an `aicp-claude-agent` instance. |
| "No idle agents available" | Agents exist but are all busy. Wait for one to finish. |
| "prompt status must be ready" | Change the prompt status to "ready" before executing. |

---

## LLM Chat

The chat input at the bottom of the center panel lets you converse with an LLM assistant.

### Capabilities

The assistant can use tools to:
- **List projects** and their details.
- **Create projects** with a name and description.
- **Add prompts** to a project.
- **List and create snippets**.
- **List and create snippet collections**.

### Usage

Type a message and press Enter. The assistant streams its response. If it needs to perform an action (like creating a project), it will call the appropriate tool automatically.

### Slash Commands

Type `/` in the chat input to see available commands:

| Command | Action |
|---|---|
| `/new` | Create a new untitled prompt in the current project |
| `/snippet` | Open the snippet selector to insert a snippet |
| `/model` | Switch the LLM provider/model |
| `/refine` | Refine the most recent prompt using the LLM |
| `/history` | View execution history for the current project |

---

## Refine

Refine uses an LLM to improve prompt text --- making it clearer, more specific, and better structured.

### Manual Refine

1. Open a prompt card.
2. Click **Refine** in the action bar.
3. A spinner appears while the LLM processes.
4. The refined text replaces the original body and is auto-saved.
5. The editor opens so you can review and further edit.

### Auto Refine

When the refine mode is set to **Auto** (via the Telemetry Panel toggle or Settings):
- Prompts are automatically refined when their status changes to **ready**.

### Refine System Prompt

The system prompt that guides refinement can be customized:

1. Open **Settings** (gear icon in TopBar).
2. Edit the **Refine System Prompt** textarea.
3. Changes are saved automatically.
4. Click **Reset to default** to restore the built-in system prompt.

---

## Tomorrow Morning Mode

AICP is designed so that opening it feels like **continuation, not reboot**. On startup:

- Your **last active project** is selected automatically.
- Your **last active prompt** is highlighted.
- **Scroll position** is restored per project.
- **Model selection** and **refine mode** are preserved.
- **Panel widths** (left and right) are restored.
- **Prompt preview height** and **history snapshot delay** settings are restored.
- **Agent connection state** is shown immediately in the Telemetry Panel.

Nothing to configure --- this is built in. Close the browser, come back tomorrow, and pick up exactly where you left off.

---

## Settings

Open Settings from the gear icon in the TopBar.

### Refinement

| Setting | Description |
|---|---|
| **Mode** | Manual (refine on demand) or Auto (refine on status change to ready) |
| **System Prompt** | The instruction given to the LLM when refining prompts. Click **Reset to default** to restore the built-in prompt. |

### Prompt Cards

| Setting | Description |
|---|---|
| **Preview Height** | Number of lines shown in prompt card previews before "More..." truncation (1–20, default 3). Stored locally. |

### History

| Setting | Description |
|---|---|
| **Snapshot Delay** | Seconds of editing inactivity before a history snapshot is saved (5–60s, default 20s). The timer resets on every keystroke. Stored locally. |

### Model Selection

In the **Telemetry Panel** (right sidebar), use the model selector to choose:
- **Provider**: Gemini, OpenAI, or Anthropic (only configured providers appear).
- **Model**: The specific model to use for chat and refine operations.

Model selection is persisted per project.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` / `Ctrl+K` | Open Command Palette |
| `Escape` | Close active modal, panel, or prompt card |
| `Arrow Up/Down` | Navigate command palette and suggestion lists |
| `Enter` | Select item in command palette or suggestion list |

---

## Command Palette

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the command palette.

### Available Commands

- **View projects** --- navigate to the project list.
- **New project** --- open the project creation form.
- **Search** --- type to search across project names. Results appear as you type (max 5 shown).

Navigate with arrow keys, select with Enter, dismiss with Escape.

---

## Activity & History

### History Panel

The History panel shows edit history for prompts. It appears in the **right sidebar**, replacing the Agents list when active.

**Two entry points:**

| Entry Point | Scope | How to Open |
|---|---|---|
| **Prompt card History button** | History for that single prompt | Click **History** in the prompt card or editor action bar |
| **Project `...` menu → History** | All history across the entire project | Hover over a project name in the NavPanel, click `...`, then **History** |

**History entry actions:**

| Action | Description |
|---|---|
| **View** | Open a read-only view of the prompt at that point in time |
| **Restore** | Revert the prompt to the state captured in this history entry |
| **Delete** | Remove the history entry |

**How history snapshots are created:**

- **Auto-save** (800ms debounce) saves prompt edits frequently but does **not** create history entries.
- **History snapshots** are created after a configurable period of inactivity (default 20 seconds). The timer resets on every keystroke, so snapshots only fire during genuine pauses.
- **Closing the editor** (Escape or back button) creates a snapshot if content changed since the last snapshot.
- **Manual Save** (clicking the Save button) creates a history entry.
- **Status changes** create a history entry.

Click **History** again on the same prompt to refresh the list. Click **Dismiss** (×) to close the panel and return to the Agents view.

### Activity Log

Every action in AICP is logged with before/after state:

- Navigate to a project's **Activity** tab to see all actions.
- Actions include: create, update, delete, execute, status_change, reorder, restore.
- Each entry shows the actor (user or LLM), timestamp, and state diff.

### Recently Deleted

Click the **trash icon** in the TopBar to open the Recently Deleted panel. From here you can:
- Browse all archived (soft-deleted) items.
- **Restore** items back to active state.
- **Permanently delete** items that are no longer needed.

---

## Telemetry Panel

The right sidebar shows real-time information:

### Connected Agents

- Lists all agents connected to the selected project.
- Shows each agent's **machine name** and **status** (idle, busy, offline).
- Updates in real time via WebSocket.

### Model Selector

- Choose the LLM provider and model for chat and refine operations.
- Only providers with configured API keys are available.

### Refine Mode Toggle

- Switch between **Manual** and **Auto** refine modes.

---

## Connecting an Agent (CCA)

The **Claude Conductor Agent (CCA)** is the local CLI wrapper (`aicp-claude-agent`) that runs alongside Claude Code on your machine. It maintains a PTY connection to Claude Code and an outbound WebSocket connection to the CCO backend.

### How It Works

1. CCA starts locally and launches Claude Code via PTY.
2. It opens a persistent WebSocket connection to `wss://<your-aicp-url>/ws`.
3. It sends a `register` message with its `agent_id`, `project_id`, and `machine_name`.
4. The backend confirms registration and the agent appears in the Telemetry Panel.
5. CCA sends periodic `heartbeat` messages to stay connected.
6. CCA tracks its state: **idle** (waiting), **busy** (executing), or **offline** (disconnected).

### Execution Flow

1. You click **Execute** on a prompt in the UI.
2. CCO sends an `execute_prompt` message to CCA over the WebSocket.
3. CCA injects the prompt text into Claude Code (only when idle and input buffer is empty).
4. Claude Code processes the prompt. CCA streams output messages back to CCO.
5. CCA detects completion (via output inactivity) and sends `execution_complete`.
6. CCA returns to **idle** status. The prompt status updates to **done**.

### Agent Statuses

| Status | Meaning |
|---|---|
| **idle** | Agent is connected and waiting for work. Prompt injection only occurs in this state. |
| **busy** | Agent is executing a prompt. Execution requests are ignored while busy. |
| **offline** | Agent has disconnected. |

### Safety Rules

- Prompt injection only occurs when CCA is in the **idle** state, no user input is pending, and Claude is not responding.
- CCA ignores execution requests while busy --- no queueing.
- If CCA disconnects mid-execution, the execution is marked as failed and partial output is preserved.

---

## API Reference

All API endpoints are under `/api`. Responses are JSON unless otherwise noted.

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects` | List active projects |
| `GET` | `/api/projects/deleted` | List archived projects |
| `GET` | `/api/projects/:id` | Get a project |
| `GET` | `/api/projects/:id/stats` | Get prompt & session counts |
| `GET` | `/api/projects/:id/tree-metrics` | Get execution metrics and heatmaps |
| `PATCH` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Soft-delete a project |
| `POST` | `/api/projects/:id/restore` | Restore a project |
| `POST` | `/api/projects/:id/permanent-delete` | Permanently delete a project |

### Prompts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/prompts` | Create a prompt |
| `GET` | `/api/prompts?project_id=X` | List prompts for a project |
| `GET` | `/api/prompts/deleted?project_id=X` | List deleted prompts |
| `PATCH` | `/api/prompts/:id` | Update a prompt (append `?skip_log=true` to suppress history logging) |
| `DELETE` | `/api/prompts/:id` | Soft-delete a prompt |
| `POST` | `/api/prompts/:id/restore` | Restore a prompt |
| `POST` | `/api/prompts/:id/permanent-delete` | Permanently delete |
| `PATCH` | `/api/prompts/reorder` | Batch reorder prompts |
| `POST` | `/api/prompts/:id/execute` | Execute on an agent |
| `POST` | `/api/prompts/:id/refine` | Refine with LLM |

### Snippets

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/snippets` | Create a snippet |
| `GET` | `/api/snippets` | List active snippets |
| `GET` | `/api/snippets/deleted` | List deleted snippets |
| `GET` | `/api/snippets/:id` | Get a snippet |
| `PATCH` | `/api/snippets/:id` | Update a snippet |
| `DELETE` | `/api/snippets/:id` | Soft-delete |
| `POST` | `/api/snippets/:id/restore` | Restore |
| `POST` | `/api/snippets/:id/permanent-delete` | Permanently delete |

### Snippet Collections

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/snippet-collections` | Create a collection |
| `GET` | `/api/snippet-collections` | List active collections |
| `GET` | `/api/snippet-collections/deleted` | List deleted collections |
| `PATCH` | `/api/snippet-collections/:id` | Update a collection |
| `DELETE` | `/api/snippet-collections/:id` | Soft-delete |
| `POST` | `/api/snippet-collections/:id/restore` | Restore |
| `POST` | `/api/snippet-collections/:id/permanent-delete` | Permanently delete |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Stream chat with LLM (SSE response) |

### Conversations

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/conversations` | Create a conversation |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get a conversation |
| `GET` | `/api/conversations/:id/messages` | Get messages |
| `PATCH` | `/api/conversations/:id` | Update a conversation |
| `DELETE` | `/api/conversations/:id` | Delete a conversation |

### Models

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/models` | Get provider config and defaults |
| `GET` | `/api/models/status` | Get provider status with available models |
| `GET` | `/api/models/registry?project_id=X` | Full registry with project overrides |
| `POST` | `/api/models/select` | Save model selection for a project |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings/refine` | Get refine settings |
| `PATCH` | `/api/settings/refine` | Update refine settings |

### Activity Logs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/activity-logs` | List activity logs (supports `project_id`, `entity_type`, `entity_id`, `limit`, `cursor` query params) |
| `GET` | `/api/activity-logs/:id` | Get a single activity log entry |
| `DELETE` | `/api/activity-logs/:id` | Delete a history entry |
| `GET` | `/api/logs/:id/diff` | Get a diff for a log entry |
| `POST` | `/api/restore/:id` | Restore an entity to the state captured in a log entry (supports `?force=true`) |

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents?project_id=X` | List agents for a project |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ "status": "ok" }` |

---

## Deployment

AICP is deployed to **Google Cloud Run** with a CI/CD pipeline via **Cloud Build**.

### Architecture

```
GitHub (push to main)
  → Cloud Build
    → Docker build (multi-stage: build + production)
    → Push to Artifact Registry
    → Deploy to Cloud Run
```

### Infrastructure

All infrastructure is managed via Terraform in the `aicp-infra` repository:

- **Cloud Run** service (`aicp`) with 1 min instance, 512Mi memory
- **Firestore** in Native mode (default database)
- **Artifact Registry** Docker repository
- **Secret Manager** for LLM API keys
- **Service accounts** with least-privilege IAM

### Manual Deployment

```bash
# Build and push the Docker image
docker build -t us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest .
docker push us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest

# Deploy to Cloud Run
gcloud run deploy aicp \
  --image us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest \
  --region us-central1 \
  --project aicp-dev
```

### Automatic Deployment

Push to `main` triggers Cloud Build automatically. The pipeline:
1. Builds the Docker image tagged with both `$COMMIT_SHA` and `latest`.
2. Pushes to Artifact Registry.
3. Deploys the SHA-tagged image to Cloud Run.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server listen port |
| `NODE_ENV` | `development` | Environment (`development` or `production`) |
| `FIRESTORE_PROJECT_ID` | --- | GCP project ID for Firestore |
| `DEFAULT_LLM_PROVIDER` | `gemini` | Default LLM provider |
| `GEMINI_API_KEY` | --- | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Default Gemini model |
| `OPENAI_API_KEY` | --- | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Default OpenAI model |
| `ANTHROPIC_API_KEY` | --- | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Default Anthropic model |

At least one LLM API key must be set. Providers without keys are marked as "not configured" and hidden from the model selector.

### Local Development

For local Firestore access, either:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file.
- Run the Firestore emulator and configure accordingly.

---

## Troubleshooting

### "No agents connected" when executing

No `aicp-claude-agent` instances are connected to the project. Start an agent and ensure it registers with the correct `project_id`.

### "No idle agents available" when executing

All connected agents are busy executing other prompts. Wait for an agent to finish or connect additional agents.

### Prompt status must be "ready" to execute

Click the status badge on the prompt card and select **ready** before clicking Execute.

### Snippet or prompt changes not showing in the sidebar

The NavPanel refreshes when you close an editor or when changes are saved. If it doesn't update, click another item and back, or refresh the page.

### Refine returns an error

- Verify that at least one LLM API key is configured.
- Check the server logs for `[refine]` entries showing the provider, model, system prompt, and user content being sent.
- Ensure the selected provider is configured (has a valid API key).

### Firestore index errors (500 on list endpoints)

If you see a 500 error with a message about a missing composite index, the Firestore index needs to be created. All indexes are managed via Terraform in `aicp-infra`. Run `terraform apply` to create missing indexes.

### Theme not persisting

Theme preference is stored in the browser. Clearing browser data will reset it.
