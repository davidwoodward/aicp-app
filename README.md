# aicp-app

Node.js/TypeScript backend for AICP — runs on Google Cloud Run with Firestore.

## Tech Stack

- TypeScript + Node.js 22
- Fastify (REST API)
- @fastify/websocket (WebSocket)
- Google Cloud Firestore
- Docker / Cloud Run

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- GCP credentials (for Firestore access)

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

The server starts on `http://localhost:8080`.

To connect to Firestore locally, either:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file
- Run the [Firestore emulator](https://cloud.google.com/firestore/docs/emulator) and set `FIRESTORE_EMULATOR_HOST`

### Build

```bash
npm run build
npm start
```

## API

### Health Check

```
GET /health
```

Returns `{ "status": "ok" }`.

### WebSocket

Connect to `ws://localhost:8080/ws`. Messages are echoed back as JSON:

```json
{ "echo": "<your message>" }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server listen port |
| `NODE_ENV` | `development` | Environment name |

## Docker

Build and run locally:

```bash
docker build -t aicp-backend .
docker run -p 8080:8080 aicp-backend
```

## Deployment

This service deploys to Cloud Run in the `aicp-dev` GCP project. Infrastructure is managed in [`../aicp-infra`](../aicp-infra).

- **Cloud Run service**: `aicp-backend`
- **Region**: `us-central1`
- **Image registry**: `us-central1-docker.pkg.dev/aicp-dev/aicp/aicp-backend`
- **Port**: 8080

## Project Structure

```
src/
├── server.ts          # Entry point
├── routes/            # Fastify route handlers
├── websocket/         # WebSocket setup and handlers
└── firestore/         # Firestore client
```
