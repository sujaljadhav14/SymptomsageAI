# Roadmap

Priority order. Tick items when done and move a one-line note into `docs/STATUS.md`. Voice agent is **postponed** (listed at the bottom).

## P0 — Security & hygiene
- [ ] **Revoke/restrict the leaked Google Maps key** in Google Cloud (user action); rotate any other key that was ever committed; confirm Gemini key deleted. Consider scrubbing history (`git filter-repo`) only after rotating
- [x] Lock down `/api/send-report` (CORS allowlist, rate limit, size caps)
- [x] Fix `server/index.js` SDK usage (`@google/genai`), model via `GEMINI_MODEL` env
- [x] Stop bundling `GEMINI_API_KEY` via `vite.config.ts` `define`
- [x] Delete stray test dumps in `services/agent/`
- [x] Clerk JWT verification on Node endpoints + client sends token (needs `CLERK_SECRET_KEY` set; **not yet tested end to end**)
- [ ] Restrict email recipient to the signed-in user's own verified address (look up via Clerk) — removes the last relay risk
- [ ] Verify Supabase RLS so a user can only read their own rows (needs Supabase dashboard access)
- [ ] Move Gemini Live off the browser key (ephemeral tokens) — only when voice resumes
- [ ] Add auth + rate limiting to the Python agent endpoints

## P1 — UI/UX
- [x] Compiled Tailwind v3 + brand theme tokens (`docs/DESIGN_SYSTEM.md`)
- [x] New landing page; offline checker + assessment result restyled; urgency colour system (`utils/urgency.ts`)
- [x] Dashboard shell (sidebar, banner, home) on new theme; Dashboard lazy-loaded
- [ ] **Sign in and review every Dashboard view in a browser** (never visually checked) and fix breakage
- [ ] Split `Dashboard.tsx` (1,800+ lines) into `views/*` (Home, Consultation, Reports, …) and a shell component
- [ ] Restyle: Consultation, Reports, Image Analysis, Hospital Locator, Agent Chat, Notification panel, report modal; remove leftover gradients/blurs
- [ ] Offline `views/OfflineAssessmentView` + `SymptomInput` restyle (structured flow)
- [ ] Mobile pass (375px) for every authenticated view; keyboard/focus/aria pass
- [ ] Reduce Dashboard chunk (2.2 MB): lazy-load three.js character, maps, jsPDF/html2canvas per view
- [ ] Language switcher scaffold (EN / हिन्दी / मराठी) with strings in `data/i18n/`
- [ ] PWA: manifest + service worker so the offline checker truly works offline
- [ ] Remove duplicate/unused components (`NearbyFacilitiesCardSimple`, Ollama/3D character if not shipping)
- [ ] Landing: clinic pilot waitlist form (section 06 currently has no CTA), Privacy/Terms pages, real social proof only when it exists
- [ ] Move Vite off port 3000 (collides with other local projects)

## P1 — Triage quality & safety
- [x] Ranking by fit (not danger) + prevalence weighting + calibrated confidence
- [ ] Vitest for `assessmentEngine` (none exist) — start with ranking, red flags, aliases
- [ ] Evaluation set: 150–200 vignettes with expected urgency; script reports under-triage rate; run in CI
- [ ] Replace loose substring symptom matching (`includes`) with synonym table + word-boundary matching
- [ ] Red-flag detection at the API edge (before any LLM), multilingual (EN/HI/MR + Hinglish); expand keyword list (e.g. "chest tightness", "सीने में दर्द")
- [ ] Structured questions (duration, severity, age, pregnancy, comorbidities, fever °C) feeding `runAssessment` — today duration/severity are hard-coded in the landing checker
- [ ] Clinician review of `data/*.json`; record reviewer + date in the files
- [ ] Age/pregnancy-aware urgency (children, elderly, pregnant women need a lower threshold)

## P2 — Backend / agent
- [ ] Replace supervisor + 4 specialists with one agent + deterministic triage state machine
- [ ] Agent: persistent checkpointer (Postgres/Redis), fix hospital lookup (needs real coordinates), vision needs a multimodal model
- [ ] Evaluate Sarvam-105B (OpenAI-compatible) vs Gemini vs local Ollama for extraction/explanation; verify tool-calling
- [ ] Docker compose entry for the agent service; update `Dockerfile`/`cloudbuild.yaml` for new env vars (`CLERK_SECRET_KEY`, `ALLOWED_ORIGINS`)

## P2 — Product / business
- [ ] Clinic dashboard: shareable intake summary link + PDF per patient (the B2B wedge)
- [ ] WhatsApp channel (Cloud API) for intake
- [ ] Consent screen + data retention/deletion controls (DPDP Act)
- [ ] Pilot plan with 2–3 clinics; pricing hypothesis
- [ ] Privacy-safe analytics: landing → checker → result funnel

## Postponed (by user, 2026-11-26)
- [ ] Voice agent: Sarvam Saaras → agent → Bulbul pipeline; Gemini Live as fallback
