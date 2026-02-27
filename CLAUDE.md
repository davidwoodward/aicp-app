## Project Overview

This is the **aicp-app** backend — a Node.js/TypeScript service running on Cloud Run. It serves a Fastify REST API and WebSocket connections, backed by Firestore.

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript
- **HTTP**: Fastify
- **WebSocket**: @fastify/websocket (integrated routing via `/ws`)
- **Database**: Firestore (Native mode, `(default)` database)
- **Deployment**: Cloud Run (port 8080, public ingress)

## Project Structure

```
src/
├── server.ts          # Entry point — Fastify server with WebSocket plugin
├── routes/            # Fastify route handlers
│   └── index.ts
├── websocket/         # WebSocket server setup and handlers
│   └── index.ts
└── firestore/         # Firestore client and data access
    └── client.ts
```

## AICP Product

This repo is one of three that make up the AICP product:

| Repo | Purpose |
|---|---|
| `aicp-infra` | Terraform infrastructure (Cloud Run, Firestore, IAM, Artifact Registry) |
| **`aicp-app`** | **This repo** — web application (backend API + frontend) |
| `aicp-claude-agent` | CLI agent wrapping Claude Code, connects to this backend via WebSocket |

The `/ws` WebSocket endpoint is the communication channel between `aicp-claude-agent` and this backend.

## Infrastructure Rule

**NEVER create, modify, or destroy infrastructure outside of Terraform.** All GCP resources — indexes, IAM bindings, APIs, Cloud Run services, Firestore databases, Artifact Registry repos, and anything else — must be defined in `aicp-infra` and applied via `terraform apply`. No `gcloud` commands that create or mutate resources. No exceptions.

## Infrastructure Context

- **GCP Project**: `aicp-dev`
- **Region**: `us-central1`
- **Cloud Run Service**: `aicp`
- **Service Account**: `aicp-backend-sa` (has `roles/datastore.user` + `roles/logging.logWriter`)
- **Artifact Registry**: `us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest`
- **Firestore**: Native mode, default database

Terraform owns Cloud Run config (scaling, env vars, IAM). Cloud Build owns the running image. The Cloud Run service has `lifecycle { ignore_changes = [image] }` set in Terraform.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Run locally with ts-node
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server listen port |
| `NODE_ENV` | `development` | Environment name |
| `FIRESTORE_PROJECT_ID` | — | Set by Cloud Run env; locally use `GOOGLE_APPLICATION_CREDENTIALS` or Firestore emulator |

## Conventions

- Keep dependencies minimal — do not add libraries unless necessary
- No authentication middleware in this service
- All routes go in `src/routes/`
- Firestore access goes through `src/firestore/client.ts`
- WebSocket handlers go in `src/websocket/` (routes use `{ websocket: true }`)
- Fastify handles HTTP and WebSocket on the same port (Cloud Run exposes one port)

## Auto-Generated Names and Titles

When auto-generating a name from content (e.g. snippets, prompts), use this algorithm:
1. Take the first line of the content
2. If 30 characters or fewer, use the full first line as the name
3. If longer, find the first word break (space) at or after position 30, and use everything to the left of it

## UI Patterns

### Delete / Archive Actions

Destructive actions (delete, archive) use a **red trash can SVG icon** — never a text button. The icon uses `stroke="var(--color-danger)"` and is placed inline in the header/title bar of the entity being edited.

**Flow:**
1. User clicks the red trash icon
2. Icon is replaced inline with a confirmation: `"Delete?" [Yes] [No]`
3. **Yes** button: red background (`rgba(239, 68, 68, 0.8)`), white text. Shows `"Deleting..."` while in progress.
4. **No** button: muted text, outlined with `border-border`
5. On success: close the editor and refresh the parent list
6. On error: revert to the trash icon state

**Trash icon SVG** (14x14, same as TopBar icons):
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
</svg>
```

**Reference implementations:** `TopBar.tsx` (icon), `SnippetManagementPanel.tsx` (inline confirm pattern), `SnippetEditor.tsx` (full pattern)

## Docker

The Dockerfile uses a multi-stage build:
1. **Build stage**: installs all deps, compiles TS
2. **Production stage**: copies `dist/` + production deps only

Image target: `us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest`
