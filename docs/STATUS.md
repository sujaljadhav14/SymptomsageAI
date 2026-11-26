# Status log

Newest first. Every session adds an entry: **what changed · what is unverified/broken · what is next.**

## 2026-11-26 — Session 2: docs, hardening, redesign

**Changed**
- **Docs:** added `CLAUDE.md` (session protocol + rules) and `docs/` (STATUS, ROADMAP, CONTEXT, DESIGN_SYSTEM) as persistent memory.
- **Security:** rewrote `server/index.js` — fixed the non-existent SDK call (`@google/genai` → `ai.models.generateContent`, model from `GEMINI_MODEL`, default `gemini-2.5-flash`), CORS allowlist (`ALLOWED_ORIGINS`), per-user/IP rate limits (email 5/h), size caps, fixed server-side image prompt, Clerk JWT verification (`@clerk/backend`, `CLERK_SECRET_KEY`; fails closed in production, skipped with a warning in dev). Client now sends the Clerk token via `utils/api.ts` (`useApi`) from Dashboard + ImageAnalysis. Removed the `GEMINI_API_KEY` `define` from `vite.config.ts`. Deleted stray `services/agent/*.json` dumps.
- **India-first safety copy:** 911 → 112 / 108 in UI, `redflags.json`, `assessmentEngine.ts`, agent prompts/hooks/tools.
- **Triage quality:** ranking no longer boosts dangerous conditions (sore throat + fever used to rank *malaria* first); added prevalence weighting; confidence is calibrated by coverage (one shared symptom is never above "possible"); chat checker now runs the raw red-flag check even when no known symptom is extracted. Urgency still comes from the highest-risk top match, so it stays conservative.
- **Design:** Tailwind CDN → compiled Tailwind v3 (`tailwind.config.js`, `postcss.config.js`, `index.css`); legacy palettes remapped to the new brand (see `DESIGN_SYSTEM.md`). New `Logo`, `HeroArt`, `utils/urgency.ts`. Landing page fully redesigned (editorial / halftone / hard shadows; removed fake "98% accuracy", "HIPAA", fake testimonial). Offline checker and `AssessmentResult` restyled with urgency colours. Dashboard desktop sidebar rebuilt (data-driven nav, 112 button), blobs removed, home view has new CTAs + quick actions.
- **Perf:** Dashboard is `React.lazy`-loaded; landing JS dropped from ~759 kB gzip to ~165 kB gzip. Dashboard chunk is still 2.2 MB (three.js, maps, PDF, AI SDKs) — see roadmap.

**Verified:** `tsc --noEmit` clean; `npm run build` OK; landing page + checker (normal and emergency input) checked in the browser at desktop and 375px, no horizontal overflow; Node server smoke-tested with curl (health, CORS rejection 403, 503 when SMTP/AI unconfigured).

**Unverified / broken / needs user**
- **User action:** revoke or restrict the leaked Google Maps key in Google Cloud; add `GEMINI_API_KEY` (new key) and `CLERK_SECRET_KEY` to the server env (`.env.local` only has `VITE_*` vars, so summaries/images/email return 503 until set); SMTP vars for email.
- The authenticated **Dashboard views were not seen in a browser** (needs Clerk sign-in). Only types/build verified. Most views (consultation, reports, image analysis, hospital locator, agent chat) only inherit the remapped palette and still contain legacy gradients/blurs.
- Real end-to-end test of Clerk-token auth on the Node API not done.
- Gemini Live voice still uses `gemini-2.0-flash-exp` + a browser-side key (voice is postponed on purpose).
- Supabase RLS not checked. `services/agent` untouched except copy changes; its supervisor design is still fragile.
- Port 3000 on the user's machine is occupied by another project ("TruthLayer") on IPv6; Vite's IPv4 bind works at `http://127.0.0.1:3000`. Consider setting a different port in `vite.config.ts`.
- Dashboard.tsx: a regex edit briefly deleted the desktop sidebar; it was rebuilt by hand. Skim the sidebar if something looks off.

**Next:** top of `ROADMAP.md` — sign in once and review/restyle each Dashboard view; split `Dashboard.tsx`; Vitest + vignette evaluation set for the rules engine; multilingual red flags at the API edge.

## 2026-11-26 — Session 1: audit (no code changes)

Full audit of the repo; findings and strategy recorded in `CONTEXT.md`. User chose: skip voice agent for now, improve UI (Vigil-style), harden and enhance everything else.
