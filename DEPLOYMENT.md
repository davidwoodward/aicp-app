# AICP-App Deployment Guide

This document provides step-by-step instructions for deploying the AICP web application across local development environments and production on Google Cloud Platform.

## Architecture Overview

AICP-App is a full-stack application served as a single process:

- **Backend:** Node.js 22 + Fastify + TypeScript (port 8080)
- **Frontend:** React 19 + Tailwind CSS + Vite (bundled and served by the backend)
- **Database:** Google Cloud Firestore (Native mode)
- **WebSocket:** `@fastify/websocket` on the same port
- **Deployment Target:** Google Cloud Run

The frontend compiles to static files in `frontend/dist/` and is served by the Fastify backend. There is no separate frontend hosting.

---

## Table of Contents

1. [Local Development on WSL](#1-local-development-on-wsl)
2. [Local Development on Windows 11 (Native)](#2-local-development-on-windows-11-native)
3. [Local Development on macOS](#3-local-development-on-macos)
4. [Production Deployment on GCP](#4-production-deployment-on-gcp)

---

## 1. Local Development on WSL

### Prerequisites

- **WSL2** with Ubuntu 22.04+ (or similar Debian-based distribution)
- **Node.js 22** (install via [nvm](https://github.com/nvm-sh/nvm))
- **npm** (bundled with Node.js)
- **Git**
- **Google Cloud SDK** (`gcloud` CLI) for Firestore authentication
- **Docker Engine** (optional, only needed for container testing)

Install Node.js 22 via nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

Install the Google Cloud SDK:

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Setup

```bash
# Clone the repository
git clone git@github.com:davidwoodward/aicp-app.git
cd aicp-app

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Configuration

Create a `.env` file in the project root (or copy from `.env.example`):

```env
PORT=8080
NODE_ENV=development
FIRESTORE_PROJECT_ID=aicp-dev
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Authenticate with GCP for Firestore access:

```bash
gcloud auth application-default login --project aicp-dev
```

This creates Application Default Credentials that the Firestore client uses automatically.

### Execution

Run the backend and frontend dev servers concurrently in two terminals:

**Terminal 1 — Backend:**

```bash
npm run dev
```

This starts the Fastify server on `http://localhost:8080` via `ts-node`.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

This starts the Vite dev server on `http://localhost:3000` with API requests proxied to `localhost:8080`.

Open `http://localhost:3000` in your browser.

---

## 2. Local Development on Windows 11 (Native)

### Prerequisites

- **Node.js 22** (download from [nodejs.org](https://nodejs.org/) or install via [nvm-windows](https://github.com/coreybutler/nvm-windows))
- **npm** (bundled with Node.js)
- **Git for Windows** ([git-scm.com](https://git-scm.com/))
- **Google Cloud SDK** ([cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install))
- **Docker Desktop** (optional, only needed for container testing)

Verify installations:

```powershell
node --version    # v22.x.x
npm --version
git --version
gcloud --version
```

### Setup

```powershell
# Clone the repository
git clone git@github.com:davidwoodward/aicp-app.git
cd aicp-app

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Configuration

Create a `.env` file in the project root:

```env
PORT=8080
NODE_ENV=development
FIRESTORE_PROJECT_ID=aicp-dev
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Authenticate with GCP:

```powershell
gcloud auth application-default login --project aicp-dev
```

### Execution

Open two terminal windows (PowerShell or CMD):

**Terminal 1 — Backend:**

```powershell
npm run dev
```

**Terminal 2 — Frontend:**

```powershell
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

### Troubleshooting

| Issue | Solution |
|---|---|
| `EACCES` permission errors on npm install | Run PowerShell as Administrator, or use `nvm-windows` to manage Node.js |
| `ts-node` not found | Ensure dev dependencies installed: `npm install` |
| Firestore connection fails | Verify `gcloud auth application-default login` completed and `FIRESTORE_PROJECT_ID` is set |
| Port 8080 already in use | Check for conflicting processes: `netstat -ano \| findstr :8080` |
| Line ending issues (`CRLF` vs `LF`) | Configure Git: `git config core.autocrlf input` |

---

## 3. Local Development on macOS

### Prerequisites

- **Homebrew** ([brew.sh](https://brew.sh/))
- **Node.js 22** (via nvm or Homebrew)
- **npm** (bundled with Node.js)
- **Git** (included with Xcode Command Line Tools)
- **Google Cloud SDK**
- **Docker Desktop** (optional, only needed for container testing)

Install prerequisites:

```bash
# Install nvm and Node.js 22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22

# Install Google Cloud SDK
brew install --cask google-cloud-sdk
```

### Setup

```bash
# Clone the repository
git clone git@github.com:davidwoodward/aicp-app.git
cd aicp-app

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Configuration

Create a `.env` file in the project root:

```env
PORT=8080
NODE_ENV=development
FIRESTORE_PROJECT_ID=aicp-dev
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Authenticate with GCP:

```bash
gcloud auth application-default login --project aicp-dev
```

### Execution

Run in two terminal tabs:

**Tab 1 — Backend:**

```bash
npm run dev
```

**Tab 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 4. Production Deployment on GCP

### Strategy Overview

AICP-App deploys as a single containerized service on **Google Cloud Run**:

1. Docker image built via multi-stage `Dockerfile` (compile backend + frontend, then copy to slim production image)
2. Image pushed to **Artifact Registry**
3. Deployed to **Cloud Run** with environment variables and secrets injected at runtime
4. **Terraform** (`aicp-infra`) owns all infrastructure configuration — Cloud Run service, IAM, Artifact Registry, Firestore

CI/CD is handled by **Cloud Build**, triggered on pushes to `main`.

### Prerequisites

- **GCP Project:** `aicp-dev`
- **Region:** `us-central1`
- **`gcloud` CLI** authenticated with sufficient IAM permissions
- **Terraform state** applied from `aicp-infra` (Cloud Run service, Artifact Registry, IAM, Firestore, Secret Manager secrets)
- **Enabled APIs:** Cloud Run, Artifact Registry, Cloud Build, Firestore, Secret Manager

Verify access:

```bash
gcloud config set project aicp-dev
gcloud auth login
```

### CI/CD Pipeline (Cloud Build)

Cloud Build is the standard deployment path. On push to `main`, the pipeline defined in `cloudbuild.yaml` executes:

**Step 1 — Build container image:**

```bash
docker build \
  -t us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:${COMMIT_SHA} \
  -t us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:latest \
  .
```

**Step 2 — Push to Artifact Registry:**

Both the SHA-tagged (immutable) and `latest` (convenience) images are pushed.

**Step 3 — Deploy to Cloud Run:**

```bash
gcloud run deploy aicp \
  --image us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:${COMMIT_SHA} \
  --region us-central1
```

### Manual Deployment

If you need to deploy outside of CI/CD:

```bash
# Build the image locally
docker build -t us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:manual .

# Authenticate Docker with Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Push the image
docker push us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:manual

# Deploy to Cloud Run
gcloud run deploy aicp \
  --image us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:manual \
  --region us-central1 \
  --project aicp-dev
```

### Configuration Management

**Environment Variables:**

Runtime environment variables are configured on the Cloud Run service via Terraform (`aicp-infra`). Key variables:

| Variable | Value | Source |
|---|---|---|
| `PORT` | `8080` | Set in Dockerfile |
| `NODE_ENV` | `production` | Set in Dockerfile |
| `FIRESTORE_PROJECT_ID` | `aicp-dev` | Cloud Run environment |

**Secrets:**

API keys are stored in **GCP Secret Manager** and injected into the Cloud Run service at deploy time:

| Secret | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |

Secrets are referenced in `cloudbuild.yaml` and mounted as environment variables on the Cloud Run revision. Secret creation and IAM bindings are managed via Terraform.

**Infrastructure Changes:**

All GCP resource modifications — scaling, memory, CPU, IAM bindings, environment variables, new secrets — must go through Terraform in `aicp-infra`. No `gcloud` commands that create or mutate resources. The Cloud Run service has `lifecycle { ignore_changes = [image] }` so Terraform owns config while Cloud Build owns the running image.

### Service Configuration

Current Cloud Run service settings (managed by Terraform):

| Setting | Value |
|---|---|
| Service name | `aicp` |
| Region | `us-central1` |
| Port | `8080` |
| Ingress | Public (all traffic) |
| Service account | `aicp-backend-sa` |
| IAM roles | `roles/datastore.user`, `roles/logging.logWriter` |

To change scaling, memory, CPU, or concurrency settings, update the Cloud Run service definition in `aicp-infra` and run `terraform apply`.

### Post-Deployment

**Monitoring:**

- **Cloud Run metrics** — request count, latency, container instance count — available in the GCP Console under Cloud Run > aicp > Metrics
- **Cloud Logging** — structured logs from the Fastify server are sent to Cloud Logging automatically. Filter by resource type `cloud_run_revision` and service name `aicp`

**Verifying a deployment:**

```bash
# Check the current deployed revision
gcloud run services describe aicp --region us-central1 --format='value(status.url)'

# View recent logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="aicp"' \
  --limit 50 --project aicp-dev

# Check Cloud Build history
gcloud builds list --project aicp-dev --limit 5
```

**Rollback:**

To roll back to a previous revision, deploy the previous SHA-tagged image:

```bash
gcloud run deploy aicp \
  --image us-central1-docker.pkg.dev/aicp-dev/aicp/aicp:<previous-commit-sha> \
  --region us-central1 \
  --project aicp-dev
```
