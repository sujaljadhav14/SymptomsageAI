# 🤖 AGENT CONTEXT FILE — SymptomSage AI: Anime Character with Lip-Sync

> **PURPOSE OF THIS FILE:** This is the single source of truth for AI agents working on this feature. It contains the full plan, implementation status, file map, decisions made, and what is remaining. Any agent that opens this file should have FULL context to continue the work without re-exploring the codebase.

---

## 📌 FEATURE GOAL

Add an **interactive anime-style 3D/2D character** (codename: **"Sage-chan"**) to the SymptomSage AI voice consultation view (`consultation` view in `Dashboard.tsx`). The character will:

1. **Idle** — Gently breathing/floating animation when inactive.
2. **Listen** — React with a listening pose/expression when the user is speaking.
3. **Speak with Lip-Sync** — Animate mouth/lips in sync with the AI's audio output (the Gemini Live audio stream).
4. **Express Emotions** — Switch between idle, listening, speaking, and "thinking" states.

---

## 🏗️ EXISTING ARCHITECTURE (Key Context)

### Project Stack
- **Frontend:** React 19 + Vite + TypeScript + **Tailwind CSS** (not vanilla CSS)
- **AI Voice:** Google Gemini Live API (`@google/genai`) — real-time bidirectional audio
- **Animation:** Framer Motion (`framer-motion`) already installed
- **Entry Point:** `components/Dashboard.tsx` (1709 lines) — handles all voice logic

### Relevant Existing State in `Dashboard.tsx`
```typescript
const [isUserSpeaking, setIsUserSpeaking] = useState(false);
const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
```

- `isUserSpeaking` → set `true` when mic input volume > 0.01 (in `scriptProcessor.onaudioprocess`)
- `isAssistantSpeaking` → set `true` when audio data arrives from Gemini; set `false` when all audio sources end

### Existing `LiveVisualizer.tsx`
- Simple 12-bar waveform visualizer component
- Props: `isActive: boolean`, `color?: string`
- Located at: `components/LiveVisualizer.tsx`

### Audio Pipeline
- **Input:** `ScriptProcessorNode` → captures mic → sends to Gemini
- **Output:** `AudioBufferSourceNode` → plays Gemini audio response chunks
- `sourcesRef` = `Set<AudioBufferSourceNode>` — tracks all playing audio nodes
- `nextStartTimeRef` = schedules sequential audio chunk playback

---

## 🎯 TECHNICAL APPROACH CHOSEN

### Character Rendering: **CSS + SVG Anime Character (2D)**
We will use a **CSS/SVG-based 2D anime-style character** rather than a heavy 3D library (Three.js/Live2D) because:
- No extra large dependencies needed
- Works with existing React/Tailwind stack
- Fast to implement
- Visually stunning with CSS animations and SVG path morphing for lip-sync
- Can still look very premium and "anime-style"

> **Rejected alternatives:**
> - Live2D Cubism SDK — Requires proprietary model files, complex SDK, licensing
> - Three.js + VRM — Heavy (~1MB+ bundle), requires 3D model authoring
> - Ready Player Me — External service dependency, overkill for hackathon

### Lip-Sync Approach: **Volume-Based Mouth Morphing**
We will use the **Web Audio API `AnalyserNode`** to get real-time volume/frequency data from the AI's audio output stream. Based on the volume level, we morph the SVG mouth shape between "closed", "slightly open", and "wide open" states. This is fast, accurate, and purely client-side.

### Character States
| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Gentle float animation, eyes blinking |
| `listening` | `isUserSpeaking === true` | Eyes widen, ear/attention pose, body leans forward |
| `speaking` | `isAssistantSpeaking === true` | Mouth animates based on audio volume |
| `thinking` | Between turns (processing) | Eyes closed, thought bubble |

---

## 📁 FILE PLAN — What Will Be Created/Modified

### New Files to Create
```
components/
  AnimeCharacter/
    index.tsx              ← Main component: exports <AnimeCharacter />
    CharacterSVG.tsx       ← The SVG drawing of the anime character (face, body)
    MouthMorpher.tsx       ← Handles mouth shape based on audio volume data
    useAudioAnalyser.ts    ← Custom hook: taps into AudioContext output, returns volume
    character.css          ← CSS keyframe animations (idle float, blink, etc.)
```

### Files to Modify
```
components/Dashboard.tsx
  - Import <AnimeCharacter />
  - Pass props: state, outputAudioContextRef
  - Render in the consultation view panel (left/center area)
```

---

## 🔧 DETAILED IMPLEMENTATION PLAN

### Phase 1: `useAudioAnalyser.ts` Hook
**Goal:** Extract real-time volume/frequency data from the output `AudioContext` so we can drive lip-sync.

```typescript
// Signature
function useAudioAnalyser(
  audioContextRef: React.RefObject<AudioContext | null>,
  isActive: boolean
): { volume: number; frequencies: Uint8Array }
```

- Creates an `AnalyserNode` connected to `audioContextRef.current.destination`
- Uses `requestAnimationFrame` loop to call `analyser.getByteTimeDomainData()` while `isActive`
- Returns normalized `volume` (0–1) and raw `frequencies` array
- Cleans up on unmount or when `isActive` becomes false

### Phase 2: `CharacterSVG.tsx` — The Anime Character Drawing
**Goal:** An SVG anime character face/bust with named, addressable parts.

Character design (SVG structure):
```
<svg> (viewBox="0 0 300 400")
  <defs> (gradients, filters for glow) </defs>
  
  <!-- Hair (back layer) -->
  <path id="hair-back" .../>
  
  <!-- Head/Face -->
  <ellipse id="face" cx="150" cy="180" rx="90" ry="100"/>
  
  <!-- Eyes -->
  <g id="eye-left">
    <ellipse id="eye-white-left" .../>
    <circle id="iris-left" .../>
    <path id="eyelid-left" .../> ← animated for blink
  </g>
  <g id="eye-right"> ... </g>
  
  <!-- Nose -->
  <path id="nose" .../>
  
  <!-- Mouth -->
  <path id="mouth" d="..."/> ← THIS IS THE LIP-SYNC TARGET
  
  <!-- Hair (front layer) -->
  <path id="hair-front" .../>
  
  <!-- Body/Outfit (medical theme — white coat) -->
  <path id="body" .../>
  
  <!-- Accessories (stethoscope) -->
  <path id="stethoscope" .../>
</svg>
```

Mouth SVG paths for morphing:
```javascript
const MOUTH_SHAPES = {
  closed:  "M 120 220 Q 150 222 180 220",         // straight line (smile)
  small:   "M 120 220 Q 150 235 180 220",         // small open
  medium:  "M 115 218 Q 150 245 185 218 Q 150 230 115 218", // medium open
  wide:    "M 110 215 Q 150 255 190 215 Q 150 240 110 215", // wide open
};
```

### Phase 3: `MouthMorpher.tsx`
- Takes `volume: number` (0–1) as prop
- Maps volume ranges to mouth shape names:
  - `0.00 – 0.05` → `closed`
  - `0.05 – 0.25` → `small`
  - `0.25 – 0.55` → `medium`
  - `0.55 – 1.00` → `wide`
- Uses Framer Motion `animate` on the SVG `d` attribute (or CSS transition)
- Note: SVG path morphing requires same number of commands — use `react-spring` or direct CSS `d` property transition

### Phase 4: `character.css` — Animations
```css
@keyframes idle-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

@keyframes blink {
  0%, 90%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.05); }
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

@keyframes listening-lean {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-3deg); }
}
```

### Phase 5: `AnimeCharacter/index.tsx` — Main Component
```typescript
interface AnimeCharacterProps {
  state: 'idle' | 'listening' | 'speaking' | 'thinking';
  outputAudioContextRef: React.RefObject<AudioContext | null>;
}
```

- Renders `CharacterSVG` with appropriate class for state
- Uses `useAudioAnalyser` to get `volume` when `state === 'speaking'`
- Passes `volume` to `MouthMorpher`
- Applies CSS class for character state animation
- Has a glowing halo/aura effect (CSS) that pulses on state changes

### Phase 6: Dashboard Integration
In `Dashboard.tsx`, inside the `consultation` view render:

```tsx
// Determine character state
const characterState = useMemo(() => {
  if (isAssistantSpeaking) return 'speaking';
  if (isUserSpeaking) return 'listening';
  if (status === ConnectionStatus.CONNECTING) return 'thinking';
  return 'idle';
}, [isAssistantSpeaking, isUserSpeaking, status]);

// In JSX (consultation view)
<div className="character-panel">
  <AnimeCharacter
    state={characterState}
    outputAudioContextRef={outputAudioContextRef}
  />
</div>
```

**Layout change:** The consultation view will be split into two panels:
- **Left panel (40%):** AnimeCharacter + status label
- **Right panel (60%):** Existing chat transcript + controls

---

## 📦 DEPENDENCIES TO INSTALL

No new heavy dependencies needed! We will use:
- `framer-motion` ← Already installed ✅
- Web Audio API `AnalyserNode` ← Browser built-in ✅
- SVG path animation via CSS `transition` on `d` property ← Browser built-in ✅

> Optional (if SVG path morphing with framer-motion is too complex): `@react-spring/web` for spring-physics mouth animation. Install with: `npm install @react-spring/web`

---

## 🎨 CHARACTER VISUAL DESIGN SPEC

**Character name:** Sage-chan (医師ちゃん)
**Style:** Chibi/semi-realistic anime medical assistant
**Color palette:**
- Hair: Deep navy blue with light blue highlights (`#1a237e`, `#5c6bc0`)
- Eyes: Bright teal/cyan (`#00bcd4`) with sparkle highlights
- Skin: Soft warm beige (`#fbe9e7` → `#ffccbc`)
- Outfit: White doctor's coat with SymptomSage blue accents (`#1565c0`)
- Aura/glow when speaking: Soft blue (`rgba(21, 101, 192, 0.3)`)

**Character anatomy (SVG coordinates, 300x400 viewBox):**
- Head: ellipse cx=150, cy=175, rx=85, ry=95
- Left eye center: (115, 165)
- Right eye center: (185, 165)
- Nose tip: (150, 195)
- Mouth center: (150, 220)
- Hair top: starts at y=80

---

## 🗺️ IMPLEMENTATION FLOW DIAGRAM

```
User Opens Consultation Tab
         │
         ▼
   AnimeCharacter renders (state="idle")
   Character floats gently, eyes blink
         │
   User clicks "Start Session"
         │
         ▼
   status = CONNECTING → state="thinking"
   Eyes closed, thought bubble animation
         │
         ▼
   status = CONNECTED
         │
    ┌────┴────┐
    │         │
User speaks  AI speaks
isUserSpeaking isAssistantSpeaking
= true       = true
    │         │
    ▼         ▼
state=      state=
"listening" "speaking"
    │         │
Lean fwd    useAudioAnalyser
Eyes wide   gets volume 0-1
            │
            ▼
        MouthMorpher
        animates SVG path
        closed→small→medium→wide
```

---

## ✅ IMPLEMENTATION STATUS TRACKER

> Update this section as tasks are completed. Mark with ✅ done, 🔄 in progress, ❌ not started, ⚠️ blocked.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Write `AGENT.md` (this file) | ✅ DONE | — |
| 2 | Create `useAudioAnalyser.ts` hook | ❌ NOT STARTED | — |
| 3 | Create `CharacterSVG.tsx` (SVG drawing) | ❌ NOT STARTED | — |
| 4 | Create `MouthMorpher.tsx` | ❌ NOT STARTED | — |
| 5 | Create `character.css` animations | ❌ NOT STARTED | — |
| 6 | Create `AnimeCharacter/index.tsx` | ❌ NOT STARTED | — |
| 7 | Modify `Dashboard.tsx` — add characterState | ❌ NOT STARTED | — |
| 8 | Modify `Dashboard.tsx` — layout split (40/60) | ❌ NOT STARTED | — |
| 9 | Modify `Dashboard.tsx` — render `<AnimeCharacter>` | ❌ NOT STARTED | — |
| 10 | Test lip-sync with real Gemini audio | ❌ NOT STARTED | — |
| 11 | Polish animations & visual design | ❌ NOT STARTED | — |
| 12 | Update `PROJECT_FEATURES.md` with new feature | ❌ NOT STARTED | — |

---

## ⚠️ KNOWN GOTCHAS & DECISIONS

1. **`AnalyserNode` must be inserted into the audio graph, not just attached to AudioContext.** We need to connect it between the source nodes and the destination. The current code connects `source → ctx.destination` directly. We need to insert `source → analyser → ctx.destination`, OR create a separate `AnalyserNode` on a `MediaStreamDestination` node.

2. **SVG `d` property animation:** CSS `transition` on SVG `d` (path data) is supported in modern browsers but path must have the same number of commands and same structure. Our `MOUTH_SHAPES` object must maintain consistent path command counts.

3. **Framer Motion SVG path morphing:** Framer Motion v12 (installed) supports `<motion.path animate={{ d: "..." }} />` — use this for smooth mouth transitions.

4. **`ScriptProcessorNode` is deprecated** (but still works). The existing audio capture uses it. Do not refactor it as part of this feature — keep that risk separate.

5. **Audio Context suspension:** Browsers suspend `AudioContext` until a user gesture. The existing code handles this via the "Start Session" button. Our `useAudioAnalyser` hook must check `audioContext.state === 'running'` before connecting.

6. **Multiple audio sources playing at once:** The current implementation queues multiple `AudioBufferSourceNode` chunks sequentially. The `AnalyserNode` should be connected to the `AudioContext.destination` to capture all of them, not just one source.

---

## 🧩 EXACT CODE LOCATION MAP (for agents)

When modifying `Dashboard.tsx`:
- **`isAssistantSpeaking` set true:** Line ~538 — `setIsAssistantSpeaking(true);`
- **`isAssistantSpeaking` set false:** Line ~549 — `if (sourcesRef.current.size === 0) setIsAssistantSpeaking(false);`
- **`isUserSpeaking` set:** Line ~492 — `setIsUserSpeaking(volume > 0.01);`
- **`outputAudioContextRef` declared:** Line ~74 — `const outputAudioContextRef = useRef<AudioContext | null>(null);`
- **Consultation view render starts:** Search for `activeView === 'consultation'` in the JSX
- **`LiveVisualizer` render:** Search for `<LiveVisualizer` — appears in the consultation view

---

## 🚀 NEXT IMMEDIATE ACTIONS (for next agent)

When you pick up this task, execute in this order:

1. **Read this file fully** ← You are doing this now ✅
2. **Start with Phase 1:** Create `components/AnimeCharacter/useAudioAnalyser.ts`
3. **Then Phase 2:** Create `components/AnimeCharacter/CharacterSVG.tsx`
4. **Then Phase 3:** Create `components/AnimeCharacter/MouthMorpher.tsx`
5. **Then Phase 4:** Create `components/AnimeCharacter/character.css`
6. **Then Phase 5:** Create `components/AnimeCharacter/index.tsx`
7. **Then Phase 6:** Modify `Dashboard.tsx`
8. **After each file:** Update the status tracker table above

---

*Last Updated: 2026-05-03 | Agent: Antigravity (Claude Sonnet 4.6 Thinking)*
