# Design system — "Clinical editorial"

Inspired by the confident editorial / neo-brutalist look of getvigil.in (cream paper, ink, hard shadows, halftone, numbered mono labels), re-coloured for health. Original artwork only — do not copy their mascot or illustrations.

## Principles
1. **Colour = urgency.** Teal/green = self-care, yellow = see doctor soon, orange = within 24h, red = emergency. Red is never used decoratively.
2. **Paper and ink.** Warm cream background, near-black text, 2px ink borders on key cards, hard offset shadows (no blur).
3. **Editorial type.** Big display headlines with one italic serif emphasis word; small mono uppercase labels (`01 — HOW IT WORKS`).
4. **Honest.** Illustrative examples are labelled. No fake stats.
5. **Calm in a crisis.** Emergency states are high-contrast, one action (call 112), no animation clutter.

## Tokens (`tailwind.config.js`)
| Token | Hex | Use |
|---|---|---|
| `paper` | `#f6f1e6` | page background |
| `paper-2` / `rule` | `#efe8d9` / `#e4dccd` | panels, borders |
| `ink` | `#0b0b0b` | text, borders, hard shadows |
| `brand` (teal) 600 | `#0d7a69` | primary buttons, links |
| `signal` | `#e3150e` | emergency only |
| `caution` | `#ffcc2e` | highlights, "soon" |
| `leaf` | `#bfe9b3` | self-care / success wash |

Remapped legacy palettes (so old classes inherit the theme): `slate` → warm neutrals, `blue`/`indigo` → brand teal ramp, `red` → signal ramp, `amber` → caution ramp.

## Type
- Display: **Bricolage Grotesque** 600–800 (`font-display`)
- Body: **Archivo** 400–700 (`font-sans`)
- Emphasis: **Instrument Serif** italic (`font-serif`) — one word per headline
- Labels: **IBM Plex Mono** 500 uppercase, tracking-wider (`font-mono`)

## Shape
- Radii remapped smaller/crisper (`rounded-xl` 10px, `2xl` 14px, `3xl` 18px).
- Hard shadows: `shadow-hard` (4px 4px 0 ink), `shadow-hard-sm` (2px), `shadow-hard-brand`, `shadow-hard-signal`. Legacy `shadow-lg/xl/2xl` are remapped to hard shadows.
- Halftone texture: `.halftone` (ink dots) and `.halftone-light` helpers in `index.css`.

## Component recipes (in `index.css`)
`.btn` `.btn-primary` `.btn-ghost` `.card` `.label-mono` `.chip` — use these in new code.

## Do / don't
- Do keep one primary action per screen. Don't stack gradients (legacy gradients still exist in untouched views; remove when restyling).
- Do put emergency numbers (112 / 108) within one tap on every screen. Don't use emoji as icons in new UI; use lucide.
