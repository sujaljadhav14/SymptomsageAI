# Project context

Long-lived background. Update when architecture, strategy or major findings change.

## 1. Architecture (as of 2026-11-26)

| Part | Role | State |
|---|---|---|
| React SPA (`components/`, `App.tsx`) | Landing, dashboard, chat, image analysis, hospital locator, reports | Works; Dashboard is a 1,800-line god component |
| Offline rules engine (`utils/assessmentEngine.ts` + `data/*.json`) | 38 symptoms, 40 conditions, red flags, test suggestions. Deterministic | Works; clinical content is hand-written and **not clinician-reviewed** |
| `server/index.js` (Express) | `/api/chat/summarize`, `/api/analyze-image`, `/api/send-report` | Was calling a non-existent SDK method; hardened in session 2 (see STATUS) |
| Gemini Live in `Dashboard.tsx` | Browser-side voice chat with `VITE_GEMINI_API_KEY` | Key is exposed to browsers; voice is postponed |
| `services/agent/` (FastAPI + LangGraph) | Supervisor + 4 specialists on Ollama qwen2.5:7b | Unfinished; 7B models mis-handle handoffs. Needs redesign (see roadmap) |
| Clerk | Auth | OK |
| Supabase | `chats` / `summaries` tables, memory | `user_id` is client-supplied; **verify RLS** |

## 2. Findings from the 2026-11-26 audit

- API keys (Gemini, Google Maps) were committed to git history. Gemini key reportedly deleted; **Maps key must be revoked/restricted in Google Cloud**. History is not rewritten, so treat both as burned.
- `/api/send-report` was an unauthenticated open mail relay with open CORS.
- Red-flag check only ran inside specialist agents, *after* a 7B supervisor routed — a mis-route skips it. Must move to the API edge, multilingual.
- Emergency copy said 911; India needs 112/108. Emergency prompt looked up hospitals at lat/long 0,0. `qwen2.5:7b` is text-only so the vision agent cannot work.
- Landing page claimed "98% accuracy", "HIPAA", and a made-up testimonial — removed.
- Tailwind was loaded from the CDN and `index.html` linked a non-existent `/index.css`.

## 3. Strategy

Generic symptom checkers are commoditised. Defensible angle: **vernacular (Marathi/Hindi/Hinglish + more) triage with a measurable safety record, delivered where users already are (WhatsApp / phone), sold to clinics as doctor-ready intake.**

Product loop: patient describes symptoms → deterministic red-flag layer → structured questions → clinician-reviewed rules decide urgency → LLM only (a) extracts symptoms from free text and (b) explains the result in the user's language → clinic receives a structured summary before the visit.

Design principle: **LLM understands and explains; rules decide.** Publish an evaluation (150–200 vignettes, under-triage rate for emergencies) — that number is the sales asset.

Candidate models (verify against docs.sarvam.ai before building): Sarvam Saaras v4 (STT, 22 Indian languages + code-mixing), Bulbul v3 (TTS, 10 Indian languages + English), Sarvam-105B (chat, OpenAI-compatible API; tool-calling support **unverified**). Voice work is postponed by the user's choice (2026-11-26).

Regulatory notes (not legal advice): keep it triage/navigation not diagnosis; DPDP Act 2023 consent + retention; get a lawyer before paid pilots.

## 4. Old docs

The old notes (`AGENT.md`, `PROJECT_FEATURES.md`, `DOCUMENTATION.md`, `metadata.json`) and the unused `LocationPrompt.tsx` were moved to a local, git-ignored `archive/` folder on 2026-11-26 (still in git history). `README.md`, `docs/SETUP.md` and `docs/DEPLOYMENT.md` are current. Treat `CLAUDE.md` + `docs/` as authoritative.
