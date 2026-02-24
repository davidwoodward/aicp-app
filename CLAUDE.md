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

## Infrastructure Context

- **GCP Project**: `aicp-dev`
- **Region**: `us-central1`
- **Cloud Run Service**: `aicp-backend`
- **Service Account**: `aicp-backend-sa` (has `roles/datastore.user` + `roles/logging.logWriter`)
- **Artifact Registry**: `us-central1-docker.pkg.dev/aicp-dev/aicp/aicp-backend:latest`
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

## Docker

The Dockerfile uses a multi-stage build:
1. **Build stage**: installs all deps, compiles TS
2. **Production stage**: copies `dist/` + production deps only

Image target: `us-central1-docker.pkg.dev/aicp-dev/aicp/aicp-backend:latest`
