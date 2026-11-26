# 📖 How to Run SymptomSage AI

Complete setup guide for the whole project: **frontend + Node backend + Python agent + Docker**.

> First time here? Skim [Project Architecture](#-architecture-overview), then jump to [Quick Start](#-quick-start).

---

## 📋 Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | ≥ 18 | Frontend (Vite) + backend (Express) |
| **npm** | ≥ 9 | JS dependency management |
| **Python** | 3.12 | Agent service |
| **uv** | ≥ 0.4 | Python env + deps ([install](https://docs.astral.sh/uv/getting-started/installation/)) |
| **Git** | any | Clone the repo |
| **Docker** *(optional)* | any | One-command full-stack run |

**Accounts / API keys you'll need:**
- [Google Gemini API key](https://aistudio.google.com/app/apikey) — required for AI
- [Clerk](https://clerk.com/) app — auth (publishable key)
- [Supabase](https://supabase.com/) project — database (URL + anon key)
- [Google Maps API key](https://console.cloud.google.com/) — Places API (hospital search)
- SMTP credentials (e.g. Gmail app password) — email reports
- [Ollama](https://ollama.com/) *(optional)* — local/offline LLM fallback

---

## 🏗️ Architecture Overview

```
symptomsage-ai/
├── components/      React UI (Dashboard, ImageAnalysis, 3D character…)
├── server/          Node/Express — /api/chat/summarize, /api/analyze-image, /api/send-report
├── services/agent/  Python LangGraph agent — /api/agent/chat (+ stream)
├── utils/           assessmentEngine, supabase, places, ollama…
├── data/            symptoms.json, conditions.json, tests.json, redflags.json
└── Docker           docker-compose.yml orchestrates all three services
```

Three services talk to each other:
1. **Frontend (Vite, :5173)** — the React app.
2. **Node backend (:3001)** — email + legacy Gemini endpoints.
3. **Agent (:8000)** — *optional but recommended* — the LangGraph agent.

---

## 🚀 Quick Start (3 terminals, local dev)

### Step 1 — Clone & install

```bash
git clone https://github.com/sujaljadhav14/SymptomsageAI.git
cd SymptomsageAI
npm install
```

### Step 2 — Configure environment variables

```bash
# Frontend + shared (loaded by Vite)
cp .env.example .env.local

# Node backend (loads from .env.local automatically, but you can also set explicitly)
cp .env.example server/.env
```

Now **edit `.env.local`** and fill in real values (see the table below).

| Variable | Where it's used | Required? |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend auth | ✅ |
| `VITE_SUPABASE_URL` | Frontend (DB) | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Frontend (DB) | ✅ |
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend (Maps) | ✅ for hospital search |
| `VITE_GEMINI_API_KEY` | Frontend (Live Voice) | ✅ for voice mode |
| `VITE_API_BASE_URL` | Frontend → Node backend | defaults to `http://localhost:3001` |
| `GEMINI_API_KEY` | Node + Agent | ✅ |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_PORT` | Node (email) | ✅ for email |
| `SERVER_PORT` | Node | defaults to `3001` |

### Step 3 — Run the frontend

```bash
npm run dev          # http://localhost:5173
```

### Step 4 — Run the Node backend (second terminal)

```bash
npm run server       # http://localhost:3001
```

✅ At this point the **core app works**: chat triage, image analysis, email, maps, offline engine.

### Step 5 *(optional but recommended)* — Run the LangGraph agent (third terminal)

```bash
cd services/agent
cp .env.example .env             # fill in GEMINI_API_KEY etc.
uv venv --python 3.12
uv sync                          # installs langgraph, langchain, fastapi…
uv run uvicorn app.main:app --reload --port 8000
```

Verify:
```bash
curl http://localhost:8000/api/agent/health
# → {"status":"ok","service":"symptomsage-agent"}
```

Try a triage turn:
```bash
curl -X POST http://localhost:8000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","message":"I have chest pain and shortness of breath"}'
```

To use the agent from the frontend, set in `.env.local`:
```
VITE_AGENT_API_URL=http://localhost:8000
```

---

## 🧪 Run the agent tests

```bash
cd services/agent
uv run pytest -v
```

Expected: `9 passed`. The emergency red-flag regression (`test_graph_emergency_path_sets_flags`) **must always pass** — it guarantees chest-pain cases are flagged as emergencies.

---

## 🐳 One-command full stack via Docker

```bash
docker compose up --build
```

This brings up:
- `frontend` on **:5173** (or :80 in production build)
- `server` on **:3001**
- `agent` on **:8000** (when the compose service is added — see below)

> Note: the compose file currently builds frontend + server. The agent service is
> scaffolded; to add it to compose, see `services/agent/README.md`.

Create a `.env` at the repo root for Docker (same keys as `.env.local`).

---

## 🧭 Common Issues

| Symptom | Fix |
|---|---|
| `Failed to fetch` in chat | Node backend not running on :3001, or `VITE_API_BASE_URL` wrong |
| Auth loop on `/app` | `VITE_CLERK_PUBLISHABLE_KEY` missing/invalid |
| Maps don't load | `VITE_GOOGLE_MAPS_API_KEY` missing or Places API not enabled |
| Agent: `No LLM available` | Set `GEMINI_API_KEY`, or run Ollama locally + set `LLM_PROVIDER=ollama` |
| Email fails | SMTP creds wrong; Gmail needs an **App Password**, not your password |
| Python: `command not found: uv` | Install uv: `pip install uv` or see [uv install](https://docs.astral.sh/uv/getting-started/installation/) |

---

## 🔐 Security notes

- **Never commit `.env.local` / `.env`.** Both are gitignored.
- `.env.example` contains only placeholders — safe to share publicly.
- The agent does **not** store uploaded images; they're processed in-memory by Gemini Vision.
- Patient data is keyed by Clerk `userId`, isolated per user in Supabase.

---

## 📂 Service-specific docs

- Agent (LangGraph): [`services/agent/README.md`](./services/agent/README.md)
- Deployment (GCP): [`GCP_DEPLOYMENT.md`](./GCP_DEPLOYMENT.md)
- Full feature reference: [`PROJECT_FEATURES.md`](./PROJECT_FEATURES.md)
