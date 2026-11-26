# SymptomSage AI — Claude working guide

Read this first, every session. It is short on purpose; details live in `docs/`.

## Session protocol (mandatory)

1. **Start:** read `docs/STATUS.md` (what happened last, what is next) and `docs/ROADMAP.md` (prioritised backlog).
2. **Work:** pick the top unchecked item in the roadmap unless the user says otherwise.
3. **End:** update `docs/STATUS.md` (add a dated entry: what changed, what is broken/unverified, what is next) and tick/add items in `docs/ROADMAP.md`. If you changed architecture or design tokens, update `docs/CONTEXT.md` or `docs/DESIGN_SYSTEM.md` too. **Never end a session with the docs stale.**

## What this project is

AI health-triage app (React 19 + Vite + Tailwind frontend, Express + FastAPI/LangGraph backends, Clerk auth, Supabase storage).
Started as a hackathon project (Jan 2026), mostly vibe-coded. Being turned into a real product.

**Chosen direction (decided 2026-11-26):** vernacular, India-first triage and doctor-ready intake summaries, sold B2B to clinics/labs/small hospitals; consumer app is the free top-of-funnel. Voice agent (Sarvam Saaras STT + Bulbul TTS + Sarvam-105B) is **deliberately postponed** — do not build it unless asked. Full reasoning: `docs/CONTEXT.md`.

## Commands

```powershell
npm install
npm run dev        # Vite frontend, http://localhost:5173
npm run server     # Express backend, :3001 (email + summarize + image analysis)
npm run build      # production build -> dist/ (run this before finishing UI work)
# Agent service (optional, Python 3.11+, uses uv):
cd services/agent; uv run uvicorn app.main:app --reload --port 8000
```

Env: frontend reads `.env.local` (`VITE_*`), Node server reads root `.env.local` too, agent reads `services/agent/.env`. See `.env.example`. **Never print, log or commit key values.**

## Git workflow

- Work on a branch, open a PR with `gh` (path: `C:\Program Files\GitHub CLI\gh.exe` if not on PATH), merge it, then `git checkout main && git pull`.
- Commits: 2-4 line plain messages, no `Co-Authored-By` trailer and no tool attribution (owner's request).
- Keep each PR a real, focused change.

## Layout

- `components/LandingPage.tsx` — public marketing page + live offline checker
- `components/Dashboard.tsx` — authenticated app shell + views (1,800+ lines; split it when touching it)
- `components/assessment/*`, `utils/assessmentEngine.ts`, `data/*.json` — **offline rules engine** (deterministic, explainable; the safety backbone)
- `components/AgentChat.tsx`, `utils/agentService.ts` — client for the Python agent (WIP, not wired by default)
- `server/index.js` — Node API (summarize, analyze-image, send-report)
- `services/agent/` — FastAPI + LangGraph agent (see its `PLAN.md`; supervisor design is fragile with 7B models)
- `docs/` — project memory (STATUS, ROADMAP, CONTEXT, DESIGN_SYSTEM)

## Hard rules

- **Safety first.** Red-flag/emergency detection must be deterministic and run *before* any LLM. Emergency numbers are **112 (national), 108 (ambulance), 102 (maternal/child)** — never "911".
- This is **triage and care navigation, not diagnosis.** Wording like "possible conditions" must always carry the disclaimer.
- No unsubstantiated claims in UI/marketing (no fake accuracy %, HIPAA, testimonials). Illustrative examples must be labelled "Illustrative example".
- Health data is sensitive (India DPDP Act 2023). Don't add logging of symptom text or send it to new third parties without noting it in `docs/CONTEXT.md`.
- Don't commit `.env*`, key material, or test dumps (`*.json` outputs in `services/agent/`).

## Conventions

- Tailwind **v3** compiled via PostCSS (not the CDN). Theme tokens live in `tailwind.config.js`; the `blue`/`slate`/`indigo`/`red`/`amber` palettes are **remapped** to the SymptomSage brand (see `docs/DESIGN_SYSTEM.md`) so legacy classes inherit the new look. Prefer the semantic tokens (`paper`, `ink`, `brand`, `signal`, `caution`) in new code.
- Triage colour semantics are fixed: green/teal = self-care, yellow = see a doctor soon, orange = within 24h, red = emergency.
- Keep components small; new UI goes in its own file, not into `Dashboard.tsx`.
