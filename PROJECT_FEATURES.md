# SymptomSage AI — Complete Project Feature Reference

> **Purpose of this document:** This file is a comprehensive feature sheet describing the SymptomSage AI project — what it does, how it works, and the technologies involved. It is intended to give another AI / person full context to generate documentation, an abstract, or a project report.

---

## 1. Project Overview

**SymptomSage AI** is an AI-powered, conversational health assistant that provides early medical guidance and triage to users before they can access a professional doctor. It bridges the gap between symptom onset and clinical consultation by offering instant, explainable, and intelligent health assessments through voice, text, and image inputs.



---

## 2. Core Problem Solved

Healthcare accessibility suffers from three critical barriers:
 
1. **PatientConfusion** — Users do not know how serious their symptoms are or whether they need emergency help.
2. **Delayed Access** — Doctors are rarely available for instant triage; clinics may be far away.
3. **Inflexible Apps** — Most health apps are slow, text-heavy, and fail without strong internet.

SymptomSage AI solves all three.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| AI Engine | Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`) |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS |
| Voice / Live | WebRTC / Gemini Live API (real-time audio streaming) |
| Backend | Node.js + Express.js (Cloud Run) |
| Email | Nodemailer (SMTP) |
| Auth | Clerk (Google Sign-In / Email) |
| Database | Supabase (PostgreSQL via REST API) |
| Maps | Google Maps Places SDK / Places API (Nearby Search) |
| Image AI | Gemini Vision (multimodal analysis) |
| Offline Engine | Local JSON rule-based expert system (no ML, no API) |
| Infrastructure | Docker, Google Cloud Run, Google Artifact Registry, Cloud Build (CI/CD) |

---

## 4. Application Architecture

The app uses a **React SPA (Single Page Application)** with client-side routing via React Router.

### Routes
- `/` — Public Landing Page (unauthenticated)
- `/app` — Main Dashboard (requires Clerk authentication)
- `/app/:view` — Specific dashboard views (chat, offline, hospital, image analysis, reports, etc.)

### Auth Flow
- Users land on the public `LandingPage`
- Sign-in is handled by **Clerk** (supports Google Sign-In)
- Once authenticated, users are routed to the full `Dashboard`
- Unauthenticated users are always redirected back to `/`

---

## 5. Key Features (Detailed)

---

### 5.1 🎙️ AI Conversational Chat (Gemini AI Chat)
**Component:** `Dashboard.tsx`

- Users type symptoms in natural language into a chat interface.
- Messages are sent to **Google Gemini 2.0 Flash** via the Gemini API.
- The AI generates follow-up questions, assesses symptoms, and provides a structured clinical report.
- AI response includes: risk level (Emergency / High / Medium / Low), precautions, recommended tests, differential diagnosis notes, and a health summary.
- Each AI response is formatted as a `ClinicalReport` object:
  ```
  {
    summary: string,
    precautions: string[],
    severity: 'low' | 'medium' | 'high' | 'emergency',
    recommendedTests: string[],
    differentiation: string
  }
  ```
- The AI uses **long-term patient memory** — previous session summaries are fetched from Supabase and injected into the system prompt so the AI personalizes responses based on the user's health history.

---

### 5.2 🔴 Live Voice Mode (Gemini Live API)
**Component:** `Dashboard.tsx` + `LiveVisualizer.tsx`

- Users can speak directly to the AI using their microphone.
- Audio is streamed in real-time using **WebRTC** and processed by the **Gemini Live API**.
- Audio helpers in `utils/audioHelpers.ts` handle microphone access and audio base64 encoding for the Gemini Live session.
- The live session maintains a connection status (DISCONNECTED / CONNECTING / CONNECTED / ERROR).
- A voice visualizer (`LiveVisualizer.tsx`) shows animation during active audio capture.
- Same triage logic and report generation applies as the text chat.

---

### 5.3 🧠 Offline Expert System (No Internet Required)
**Component:** `views/OfflineAssessmentView.tsx` + `components/assessment/`
**Engine:** `utils/assessmentEngine.ts`
**Data:** `data/symptoms.json`, `data/conditions.json`, `data/tests.json`, `data/redflags.json`

This is a **fully offline, rule-based expert system** — no machine learning, no external API calls.

**How it works:**
1. **Input Normalization** — User's free-text symptoms are cleaned, noise words removed, and mapped to known symptom IDs using an alias dictionary (e.g., "stomach ache" → `abdominal_pain`, "loose motion" → `diarrhea`).
2. **Red Flag Detection (Priority)** — Before any analysis, the engine scans for emergency keywords (e.g., chest pain, seizure, difficulty breathing). If detected, it immediately returns an emergency response.
3. **Symptom Matching** — Each symptom is cross-referenced against a local `symptoms.json` database that maps symptoms to possible conditions.
4. **Condition Scoring** — Matched conditions are scored based on:
   - Number of matching symptoms (+1 each)
   - Key symptom bonus (+2 per key symptom)
   - Risk level modifier (high = +3, moderate = +1)
   - Symptom coverage ratio bonus
5. **Confidence Levels** — Each condition match is labeled: `possible`, `likely`, or `very_likely`.
6. **Test Suggestions** — Based on the top 3 conditions, relevant diagnostic tests are suggested (from `tests.json`), sorted by priority (screening → diagnostic → specialized) and cost.
7. **Next Steps** — Personalized action plan generated based on overall risk level.

**Data Files:**
- `symptoms.json` — Maps every symptom ID to its related conditions and whether it is a key symptom.
- `conditions.json` — Contains condition name, risk level, description, common symptoms, recommended tests, and medical specialties.
- `tests.json` — Contains test name, cost (low/medium/high), priority, reason, and turnaround time.
- `redflags.json` — Emergency symptom list, keyword triggers, emergency instructions.

**Assessment UI Components:**
- `SymptomInput.tsx` — Multi-select symptom chooser with common quick-picks and a free-text search.
- `ChatSymptomChecker.tsx` — Chatbot UI for the offline mode (no API needed).
- `AssessmentResult.tsx` — Displays the full structured result with risk level badge, possible conditions, test recommendations, reasoning, and next steps.

---

### 5.4 👁️ Medical Image Analysis (Gemini Vision)
**Component:** `ImageAnalysis.tsx`

- Users upload a photo (e.g., rash, wound, skin condition, eye issue).
- The image is sent to **Gemini's multimodal (vision) API** along with a medical context prompt.
- Gemini analyses the image and returns a detailed visual assessment.
- The response includes possible diagnoses, observations, and suggested next steps.
- Supports camera capture on mobile devices via `<input type="file" accept="image/*" capture="environment">`.

---

### 5.5 📍 Hospital & Healthcare Locator (Google Maps API)
**Components:** `HospitalLocator.tsx`, `NearbyFacilitiesCard.tsx`, `NearbyFacilitiesCardSimple.tsx`, `LocationPrompt.tsx`
**Utils:** `utils/locationService.ts`, `utils/placesService.ts`

- When high-risk or emergency symptoms are detected, the user is prompted to share their location.
- The `locationService.ts` uses the browser **Geolocation API** to get the user's coordinates.
- The `placesService.ts` calls the **Google Maps Places API (Nearby Search)** to find:
  - Hospitals
  - Clinics
  - Individual doctors
  - Diagnostic labs (matched to the recommended tests)
  - Pharmacies
- Each facility shows: name, distance, rating, open/closed status, opening hours, phone number, price level, and a **direct Google Maps link**.
- Results are filtered by type (`FacilityType`: hospital | clinic | doctor | lab | pharmacy) and category (government | private).
- Labs are matched to relevant tests from the AI's recommendations.

---

### 5.6 📋 Clinical Report Generation & PDF Export
**Component:** `Dashboard.tsx`

- After every AI chat or voice session, a structured `ClinicalReport` is automatically generated.
- The report contains: health summary, risk severity, precautions, recommended tests, and differential diagnosis.
- Users can **download the report as a PDF** using a browser-based PDF generation approach.
- Users can also **email the report** to themselves (or a doctor) via the backend.

---

### 5.7 📧 Email Report Delivery
**Backend:** `server/index.js`

- The Node.js Express backend exposes a `POST /api/send-report` endpoint.
- When triggered, it uses **Nodemailer** with SMTP configuration to send a formatted HTML email to the user.
- The email contains the full clinical report in a styled HTML template, with a disclaimer.
- Backend also exposes `GET /api/health` for health checks (used by Cloud Run).

---

### 5.8 🗄️ Patient Memory & History (Supabase)
**Util:** `utils/storage.ts` + `utils/supabase.ts`

- All chat sessions and clinical reports are saved to a **Supabase** PostgreSQL database.
- Tables used:
  - `chats` — Full conversation history per user
  - `summaries` — Per-session clinical report summaries
- On new sessions, the last 5 summaries are fetched and injected into the AI's system prompt for personalized, continuous care.
- Users can view their full **health history** (all past reports) in the dashboard.
- Users can also **clear all their medical memory** at any time (privacy control).

---

### 5.9 🔔 Notification System
**Component:** `NotificationPanel.tsx`

- An in-app notification panel shows contextual health tips, follow-up reminders, and insights.
- Notification types: `health_tip`, `follow_up`, `reminder`, `insight`.
- Each notification has a read/unread state.

---

### 5.10 🔐 Authentication (Clerk)
**Framework:** Clerk React SDK

- Users sign in via Clerk (Google OAuth or email/password).
- `<SignedIn>` and `<SignedOut>` component wrappers protect all dashboard routes.
- `userId` from Clerk is used as the primary key for all Supabase database records, ensuring data isolation per user.

---

## 6. System Workflow (End-to-End)

```
User Reports Symptoms
        |
        v
  [Choose Input Mode]
   /       |       \
Voice   Text Chat  Medical Image
  \         |       /
   \        v      /
    [Gemini AI Processing]
           |
           v
    [Red Flag Check]
    /              \
Emergency?          No
    |                \
[Show Hospital        [Generate ClinicalReport]
 Locator +              /           \
 Emergency Alert]   PDF Export    Email Report
                        |
                    [Save to Supabase]
                        |
                    [Update Long-Term Memory]

  --- OR (No Internet) ---

User Reports Symptoms
        |
        v
[Offline Assessment Engine]
        |
        v
[Local JSON Database Matching]
        |
        v
[Risk Score + Test Suggestions]
        |
        v
[Structured Result — No API needed]
```

---

## 7. Deployment Architecture

- **Containerized** via Docker (multi-stage build — frontend build + Node.js server combined).
- Hosted on **Google Cloud Run** (serverless, auto-scaling).
- CI/CD via **Google Cloud Build** (`cloudbuild.yaml`) — automatically triggered on GitHub push.
- Container images stored in **Google Artifact Registry**.
- **Nginx** serves the built frontend static files inside the container.
- Environment variables managed via GCP secrets and `.env.local` locally.

---

## 8. USP (Unique Selling Points)

1. **Dual-Mode Intelligence** — Works with Gemini AI when online, switches to its own expert system offline. No other competing app offers this.
2. **Explainable AI** — Every risk assessment comes with a clear reasoning trace ("This was flagged because you mentioned X").
3. **End-to-End Patient Journey** — From symptom → AI triage → nearby hospital → report via email. One app handles it all.
4. **Long-Term Memory** — The AI remembers your previous health sessions and personalizes future consultations.
5. **Multimodal** — Works with text, voice, and medical images.
6. **Zero-Install, Web-Based** — Runs entirely in the browser, no app download needed.

---

## 9. Project File Structure Reference

```
/
├── App.tsx                   # Root router, auth guards
├── index.tsx                 # React entry point
├── types.ts                  # All TypeScript interfaces & enums
├── components/
│   ├── Dashboard.tsx         # Main app shell (chat, reports, navigation)
│   ├── LandingPage.tsx       # Public marketing landing page
│   ├── HospitalLocator.tsx   # Hospital/clinic finder UI
│   ├── ImageAnalysis.tsx     # Medical image upload & AI analysis
│   ├── NearbyFacilitiesCard.tsx       # Rich facility card UI
│   ├── NearbyFacilitiesCardSimple.tsx # Simple facility list
│   ├── NotificationPanel.tsx # Health notification panel
│   ├── LocationPrompt.tsx    # Location permission prompt
│   ├── LiveVisualizer.tsx    # Audio waveform visualizer
│   └── assessment/
│       ├── SymptomInput.tsx       # Symptom multi-select input
│       ├── ChatSymptomChecker.tsx # Offline chat-style checker
│       └── AssessmentResult.tsx   # Offline assessment result display
├── views/
│   └── OfflineAssessmentView.tsx  # Full offline mode view wrapper
├── utils/
│   ├── assessmentEngine.ts   # Offline rule-based expert engine
│   ├── locationService.ts    # Browser Geolocation API wrapper
│   ├── placesService.ts      # Google Maps Places API calls
│   ├── storage.ts            # Supabase read/write for chat & reports
│   ├── supabase.ts           # Supabase client initialization
│   └── audioHelpers.ts       # Microphone access & audio encoding
├── data/
│   ├── symptoms.json         # Symptom → condition mapping database
│   ├── conditions.json       # Medical conditions database
│   ├── tests.json            # Diagnostic tests database
│   └── redflags.json         # Emergency symptom triggers
├── server/
│   └── index.js              # Express backend (email API)
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Local development compose
├── cloudbuild.yaml           # GCP Cloud Build CI/CD pipeline
└── nginx.conf                # Nginx config for serving frontend
```
