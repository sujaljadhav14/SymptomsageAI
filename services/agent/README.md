# SymptomSage Agent Service

A **Python LangGraph** agentic triage service for SymptomSage AI. It wraps the
existing app capabilities (red-flag detection, triage, vision, patient memory,
hospital search, email) as **tools** that an LLM agent orchestrates end-to-end.

> ⚠️ For informational purposes only — not a medical diagnosis.

## Architecture

```
START → intent_router → tool_executor → response_synthesizer → END
```

The agent classifies intent, runs the right tools (with emergency short-circuit),
and synthesises a final answer. Streaming is supported via SSE.

## Tools

| Tool | Purpose |
|---|---|
| `check_red_flags` | Emergency detection (always runs first on symptoms) |
| `generate_triage_report` | Structured ClinicalReport via LLM |
| `recall_patient_history` | Fetch prior Supabase summaries |
| `save_session_summary` | Persist this session to Supabase |
| `analyze_medical_image` | Gemini Vision on uploaded photos |
| `find_nearby_facilities` | Google Maps Places nearby search |
| `email_report` | Delegate to Node backend `/api/send-report` |

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Python 3.12.

```bash
cd services/agent
cp .env.example .env          # fill in keys
uv venv --python 3.12
uv sync --extra dev
```

## Run

```bash
# Start the API (default http://localhost:8000)
uv run uvicorn app.main:app --reload --port 8000

# Smoke test
curl http://localhost:8000/api/agent/health
```

## Tests

```bash
uv run pytest -v
```

The emergency red-flag regression test (`test_graph_emergency_path_sets_flags`)
must always pass — it guarantees chest-pain / breathing cases are flagged.

## API

- `POST /api/agent/chat` — one turn, JSON response
- `POST /api/agent/chat/stream` — one turn, SSE event stream
- `GET /api/agent/health` — health check

Request body:
```json
{
  "user_id": "clerk-user-id",
  "message": "I have chest pain and shortness of breath",
  "image_base64": null
}
```

See the root [`RUN.md`](../../RUN.md) for how this fits the whole project.
