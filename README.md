# SymptomSage

**Tell it what you're feeling. It tells you how urgent it is and what to do next.**

SymptomSage is a health triage app. You describe your symptoms in plain words, and it answers one simple question: *do I need an emergency room, a doctor soon, or just rest at home?* It is built first for people in India, so emergency advice points to **112** and **108**.

> **Important:** SymptomSage gives guidance, not a medical diagnosis. It is an early-stage project and its medical rules have not yet been reviewed by a doctor. In an emergency, call 112 (ambulance: 108).

---

## What it does

- **Free symptom check.** Type what you feel and get a clear urgency level. It runs in your browser, so it works on a slow connection and nothing you type leaves your device.
- **Emergency signs first.** Before anything else, it looks for danger signs like chest pain or trouble breathing, using fixed rules instead of AI guesses.
- **Four easy levels.** Every result is one of: *Emergency*, *See a doctor within 24 hours*, *See a doctor this week*, or *Home care*. Each one has its own colour.
- **Explains itself.** You can see which symptoms led to the result and which tests a doctor may suggest.
- **Reports.** Save a report, download it, or email it to yourself to show your doctor (needs sign-in).
- **Photo check.** Add a photo of a rash or wound for an AI-assisted look (needs sign-in).
- **Care nearby.** Find hospitals, clinics, labs and pharmacies near you.
- **AI assistant.** A chat assistant that remembers your earlier visits (needs sign-in; still experimental).

## How it works

1. You describe your symptoms.
2. The app checks for emergency signs, then matches your symptoms against a table of common conditions and scores the best fits.
3. You get an urgency level, the reasons, and a next step.

The AI parts help with conversation, photos and summaries. The decision about how urgent something is comes from the written rules, so the answer is the same every time and easy to check.

## Try it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/sujaljadhav14/SymptomsageAI.git
cd SymptomsageAI
npm install
cp .env.example .env.local     # then add your own keys inside
npm run dev                    # opens at http://localhost:5173
```

The landing page and the free symptom check work without any keys. Sign-in, reports, photos, maps and email each need their own keys. The full, step-by-step guide is in [docs/SETUP.md](docs/SETUP.md).

## What's in the folders

| Folder | What it's for |
|---|---|
| `components/` | The screens and pieces you see in the app |
| `utils/` | The symptom-checking logic and helpers |
| `data/` | The symptom, condition, test and emergency-sign lists |
| `server/` | A small server for email, summaries and photo analysis |
| `services/agent/` | An experimental Python AI assistant (optional) |
| `docs/` | Setup, deployment, roadmap and project notes |

Built with React, TypeScript and Tailwind on the front end, Node on the back end, Clerk for sign-in and Supabase for saved data.

## Where the project is going

The plan is to make triage work in Indian languages (Hindi, Marathi, Hinglish), have doctors review the medical rules, and give clinics a short patient summary before each visit. The detailed to-do list is in [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/STATUS.md](docs/STATUS.md) shows what changed most recently.

## More docs

- [Setup guide](docs/SETUP.md): run everything locally
- [Deployment](docs/DEPLOYMENT.md): put it online with Google Cloud
- [Design system](docs/DESIGN_SYSTEM.md): colours, fonts and style rules
- [Project context](docs/CONTEXT.md): decisions and background

## License

MIT. See [LICENSE](LICENSE).
