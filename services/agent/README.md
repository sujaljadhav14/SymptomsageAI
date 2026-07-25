# SymptomSage Agent Service

A **Python LangGraph multi-agent** triage service for SymptomSage AI. A
**supervisor agent** routes each message to one of four specialist sub-agents,
each of which is a real **ReAct agent** that dynamically chooses which tools to
call.

> ⚠️ For informational purposes only — not a medical diagnosis.

## Architecture

```
                         ┌──▶ emergency_agent  (red flags + hospitals + email)
user ──▶ sage_supervisor ┼──▶ triage_agent     (recall → follow-ups → report → save)
                         ├──▶ vision_agent     (image analysis + report)
                         └──▶ general_agent    (FAQ / help, no tools)
```

Each specialist is a `create_react_agent` with its own tool set, system prompt,
and ReAct loop — the **LLM decides which tools to call**, not hardcoded
if/elif branches. Multi-turn memory is provided by a `MemorySaver` checkpointer
keyed by `session_id`.

### What makes this genuinely agentic

| Capability | How |
|---|---|
| **Dynamic tool selection** | LLM function-calling via `create_react_agent` |
| **ReAct loop** | Each specialist thinks → calls tool → observes → repeats |
| **Multi-agent routing** | Supervisor classifies intent and hands off |
| **Multi-turn memory** | `MemorySaver` keyed by `session_id` (thread_id) |
| **Follow-up questions** | `ask_followup` tool uses `interrupt()` to pause and ask the user |
| **Per-tool streaming** | SSE events `tool_start` / `tool_end` / `token` / `node` |
| **Human-in-the-loop** | `/api/agent/chat/resume` continues after an interrupt |

## Tools per specialist

| Specialist | Tools |
|---|---|
| `emergency_agent` | `check_red_flags`, `find_nearby_facilities`, `email_report` |
| `triage_agent` | `check_red_flags`, `recall_patient_history`, `ask_followup`, `generate_triage_report`, `save_session_summary`, `email_report` |
| `vision_agent` | `check_red_flags`, `analyze_medical_image`, `generate_triage_report`, `email_report` |
| `general_agent` | (none — pure chat) |

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Python 3.12.

```bash
cd services/agent
cp .env.example .env          # fill in GEMINI_API_KEY etc.
uv venv --python 3.12
uv sync --extra dev
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agent/health` | Health check |
| POST | `/api/agent/chat` | One turn, JSON response (multi-turn via `session_id`) |
| POST | `/api/agent/chat/stream` | One turn, SSE stream (`token`/`tool_start`/`tool_end`/`node`/`done`) |
| POST | `/api/agent/chat/resume` | Resume after a follow-up interrupt |
| GET | `/api/agent/session/{id}/history` | Replay a session's messages |

### Example: multi-turn triage

```bash
# Turn 1 — user reports symptoms
curl -X POST http://localhost:8000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s1","user_id":"u1","message":"I have chest pain"}'

# Turn 2 — SAME session_id → agent remembers context
curl -X POST http://localhost:8000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s1","user_id":"u1","message":"also shortness of breath"}'
```

### SSE event format (from `/chat/stream`)

```
event: token      data: {"text":"Based on", "node":"triage_agent"}
event: tool_start data: {"tool":"check_red_flags","args":{"symptom_text":"..."}}
event: tool_end   data: {"tool":"check_red_flags","result":"no emergency"}
event: node       data: {"node":"triage_agent"}
event: done       data: {"status":"complete","session_id":"s1"}
```

## Tests

```bash
uv run pytest -v      # 18 tests
```

Red-flag tool tests are deterministic (no LLM). Graph-structure tests verify
the supervisor + all 4 specialists are wired. Full LLM-driven flows are
verified manually via the endpoints above.

See the root [`RUN.md`](../../RUN.md) for the whole-project setup.
