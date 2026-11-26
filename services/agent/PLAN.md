# PLAN — SymptomSage Multi-Agent Upgrade (WIP)

> Branch: `feature/multi-agent-upgrade`
> LLM: **qwen2.5:7b via Ollama** (Gemini key deleted, qwen2.5 confirmed supports tool calling)
> Last updated: 2026-07-28

---

## ✅ What's DONE and working

- [x] Architecture rewritten: `supervisor → 4 specialist sub-agents` (was linear pipeline)
- [x] Each specialist = `create_react_agent` with its own tools + ReAct loop
- [x] Supervisor compiles, all 4 specialists wired (verified by 18 unit tests)
- [x] qwen2.5:7b pulled and confirmed supports native tool calling
- [x] `.env` configured: `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5:7b`
- [x] 5 endpoints registered: health, chat, chat/stream, chat/resume, session/history
- [x] Error handling added to chat + resume endpoints (no more raw 500s)
- [x] Supervisor DOES route correctly (chest pain → emergency_agent ✅)

## ❌ What's BROKEN right now (being fixed)

### Bug 1: Specialist agents don't call their tools
- **Symptom:** emergency_agent receives "chest pain", but instead of calling
  `check_red_flags`, it immediately calls `transfer_back_to_sage_supervisor`.
- **Evidence:** message history shows:
  ```
  0. [human] I have chest pain...
  1. [ai] sage_supervisor: (routes) → transfer_to_emergency_agent
  2. [tool] transfer_to_emergency_agent (ok)
  3. [ai] emergency_agent: "-transfer_to_emergency_agent"  ← tool name as TEXT, not a call
  4. [ai] emergency_agent: Transferring back to sage_supervisor  ← bails immediately
  ```
- **Root cause:** qwen2.5 treats the supervisor's handoff as the completed task
  and returns control without doing its own work. The specialist prompt needs to
  FORCE tool execution as the first action before any transfer-back.

### Bug 2: qwen2.5 emits tool names as text
- **Symptom:** emergency_agent outputs `-transfer_to_emergency_agent` as plain
  text instead of a proper function call.
- **Root cause:** qwen2.5 sometimes mixes text + tool-call format. Need stronger
  system prompt directive: "Never output tool names as text. Use function calling."

## 🔧 What we're implementing NOW (this session)

1. **Rewrite specialist prompts** — force tool execution first, explicit "do not
   transfer back until tools are done" instruction, "never emit tool names as text".
2. **Add `recursion_limit`** to the graph config so the supervisor has enough
   steps to complete a full route→specialist→tools→back cycle.
3. **Re-test all 4 specialists** end-to-end with qwen2.5:
   - emergency_agent (chest pain → must call check_red_flags)
   - triage_agent (headache → must recall history + generate report)
   - vision_agent (with image → must call analyze_medical_image)
   - general_agent (greeting → pure chat, no tools)
4. **Test streaming endpoint** (`/chat/stream`) — verify tool_start/tool_end events.
5. **Commit + push** the working code.

## 📋 What's NOT in scope (future work, separate session)

- Frontend wiring (Dashboard.tsx → agent streaming endpoint)
- Production checkpointer (Redis/Postgres instead of in-memory)
- Docker compose entry for the agent service
- Gemini re-integration (key was deleted; qwen2.5 is the LLM now)

## 🏗️ Architecture (current)

```
user ──▶ sage_supervisor ──┬──▶ emergency_agent  (check_red_flags, find_nearby_facilities, email_report)
                           ├──▶ triage_agent     (check_red_flags, recall_patient_history, ask_followup,
                           │                       generate_triage_report, save_session_summary, email_report)
                           ├──▶ vision_agent     (check_red_flags, analyze_medical_image, generate_triage_report, email_report)
                           └──▶ general_agent    (no tools, pure chat)

Multi-turn: MemorySaver checkpointer keyed by session_id
Streaming:  SSE events (token, tool_start, tool_end, node, done)
HITL:       ask_followup tool uses interrupt() → /chat/resume continues
```

## 🧪 Test plan (after fixes)

| # | Test | Expected specialist | Expected tools called |
|---|---|---|---|
| 1 | "I have severe chest pain and can't breathe" | emergency_agent | check_red_flags ✅ |
| 2 | "I have a headache and mild fever" | triage_agent | check_red_flags, recall_patient_history, generate_triage_report |
| 3 | "hello, what can you do?" | general_agent | (none) |
| 4 | (with image) "look at this rash" | vision_agent | analyze_medical_image |
| 5 | Same session_id twice | (multi-turn) | agent remembers context |
| 6 | `/chat/stream` endpoint | any | SSE events: tool_start, tool_end, token |
