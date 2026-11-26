# Setup guide

How to run SymptomSage on your own computer. Start with the basic version; add the extras only if you need them.

## What you need

- [Node.js](https://nodejs.org) 18 or newer
- Git
- *Optional:* Python 3.12 and [uv](https://docs.astral.sh/uv/getting-started/installation/) for the AI assistant service
- *Optional:* Docker, to run everything with one command

## 1. Get the code

```bash
git clone https://github.com/sujaljadhav14/SymptomsageAI.git
cd SymptomsageAI
npm install
```

## 2. Add your keys

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in what you have. Each feature only needs its own keys, so you can start with none.

| Key | What it turns on |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Sign-in (needed to open the dashboard) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Saving reports and memory |
| `VITE_GOOGLE_MAPS_API_KEY` | Hospital and clinic search |
| `VITE_GEMINI_API_KEY` | Voice consultation (experimental) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Report summaries and photo analysis (server) |
| `CLERK_SECRET_KEY` | Lets the server check that a user is signed in (required in production) |
| `ALLOWED_ORIGINS` | Websites allowed to call the server (default: local ones) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Emailing reports |
| `VITE_API_BASE_URL` | Where the server lives (default `http://localhost:3001`) |

Never commit `.env.local`. It is already ignored by git. If a key ever leaks, delete it in the provider's dashboard and make a new one.

## 3. Start the app

Open two terminals in the project folder.

```bash
npm run dev       # the website  -> http://localhost:5173
```

```bash
npm run server    # the server   -> http://localhost:3001
```

The landing page and the free symptom check work with just the first one. The server is needed for email, report summaries and photo analysis.

## 4. Optional: the AI assistant service

This is an experimental Python service. Skip it unless you're working on it.

```bash
cd services/agent
cp .env.example .env     # add your model settings
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Check it is alive: open http://localhost:8000/api/agent/health. To use it from the website, add `VITE_AGENT_API_URL=http://localhost:8000` to `.env.local`. More detail is in [services/agent/README.md](../services/agent/README.md).

Run its tests with `uv run pytest -v`.

## 5. Optional: run everything with Docker

```bash
docker compose up --build
```

Docker reads the same keys, so put them in `.env.local` first. Deploying to the internet is covered in [DEPLOYMENT.md](DEPLOYMENT.md).

## When something goes wrong

| What you see | What to try |
|---|---|
| "Failed to fetch" in the app | The server isn't running, or `VITE_API_BASE_URL` is wrong |
| Sign-in keeps looping | `VITE_CLERK_PUBLISHABLE_KEY` is missing or wrong |
| Maps don't load | Add a Maps key and turn on the Places API for it |
| Server says "not configured" (503) | Add the matching key: `GEMINI_API_KEY` for AI, the `SMTP_*` keys for email |
| Email fails | Gmail needs an *app password*, not your normal password |
| Port already in use | Another program is using it. Stop it, or change the port in `vite.config.ts` |
| `uv: command not found` | Install uv from the link above |

## Checking your work

```bash
npx tsc --noEmit    # catches type mistakes
npm run build       # makes sure the production build works
```
