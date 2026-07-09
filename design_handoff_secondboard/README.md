# Handoff: SecondBoard — Local Chess Review Companion

## 0. How to read this package

This package has four documents plus reference assets. **Read them in this order:**

1. **`SecondBoard_PROJECT_OVERVIEW.md`** — the product/architecture ground truth (vision, tech stack, data model, analysis pipeline, roadmap). Authoritative for *what to build and how the system is structured*.
2. **`README.md`** (this file) — the exact **UI spec**: design tokens, classification system, and a 1:1 layout + per-component breakdown of every screen. Authoritative for *how it looks*.
3. **`LOGIC.md`** — the exact **behavior spec**: state model, screen/tab transitions, keyboard, the board + piece-slide animation, chart math, the backend command contract, and **Rust/Svelte porting notes for every algorithm**. Authoritative for *how it works*. Read this before writing any interactive code.
4. **`reference/logic/*.js`** — the prototype's JavaScript logic **extracted into clean, runtime-free ES modules** so you never have to untangle the proprietary DC runtime (see §1). `chess-mock.js` (mock SAN engine — replace with Rust/shakmaty), `view-math.js` (pure SVG/geometry helpers — reusable as-is), `data.js` (the `CLS` classification spec to keep + all mock screen content to replace).
5. **`reference/SecondBoard.dc.html`** — the authoritative **visual + interaction reference** (markup + the original `Component` class). Read as spec, not as portable code.
6. **`reference/piece_sprites/*.svg`** — the 12 chess piece SVGs used by the board, extracted verbatim so you can reuse them 1:1.
7. **`reference/screens/*.png`** — rendered reference screenshots of each designed screen (the pixel target to match):
   - `1-onboarding-paste-pgn.png`
   - `2-game-review-analysis-tab.png` (the primary screen)
   - `3-game-review-review-tab.png`
   - `4-dashboard-home.png`
   - `5-opening-explorer.png`
   - `6-insights-weakness-timeline.png`
   - `7-training.png`

Your job: **build the real application described in the OVERVIEW (Tauri v2 + SvelteKit/Svelte 5 + Rust + SQLite + Stockfish), recreating the UI in `SecondBoard.dc.html` pixel-for-pixel with zero visual deviation.** There is no existing repo — you are scaffolding from zero.

> **On "the logic":** the prototype's full JS logic ships inside `reference/SecondBoard.dc.html` (the `Component` class), but it is written against a proprietary template runtime. To save you from reverse-engineering that, every reusable algorithm has been lifted out into plain modules under `reference/logic/` and walked through in `LOGIC.md`. Nothing is missing — the view-math helpers are directly importable, and the chess/analysis logic is documented as a *data contract* to be fulfilled by the Rust backend (it is intentionally NOT ported as JS, because Stockfish + Rust own that truth — OVERVIEW §21.1).

---

## 1. About the design file (READ FIRST)

`reference/SecondBoard.dc.html` is a **design reference created in HTML** — a working prototype showing the intended look and behavior. **It is NOT production code and must not be copied verbatim.**

Critical points:

- The file is a "Design Component" (`.dc.html`) that runs on a **proprietary in-browser template runtime** (`support.js`, the `<x-dc>` tag, `<sc-for>`/`<sc-if>` control-flow tags, `{{ dotted.path }}` holes, and a `class Component extends DCLogic` logic block). **None of this runtime exists in the target stack and none of it should be ported.** Do not try to load `support.js`, do not reproduce `<x-dc>`/`<sc-for>`/`<sc-if>`, do not subclass `DCLogic`.
- Read it as: **markup + inline styles = the exact visual spec**, and **the `Component` class = the exact behavior/state spec**. Translate both into idiomatic Svelte 5 (runes: `$state`, `$derived`, `$effect`; `{#each}`/`{#if}`; component props).
- All styling in the reference is **inline `style="…"`**. When you rebuild in Svelte, you may use scoped `<style>` blocks, Tailwind, or CSS modules — but **every color, size, radius, weight, gap, and shadow must match the values documented in §4 and present in the file exactly.**
- Some interactive attributes use JSX-style names (`onClick`, `onChange`, `className`). In Svelte these become `onclick`, `oninput`/`onchange`, `class`.

### Reference-only behaviors baked into the prototype
The prototype fakes the engine + game logic in JavaScript so the mock is interactive. In the real app these are replaced by the Rust backend, but **the UI contract (what data the frontend needs) is exactly what these functions produce**:

- A tiny **SAN → board-position engine** (`standardBoard`, `applySan`, `canReach`, `clearPath`, `buildGame`) turns a hardcoded move list into a per-ply array of piece positions. **Replace with real move data from the Rust `pgn` module** (FEN per ply / piece maps).
- **Move classifications**, **eval-per-ply**, **best moves**, and **coach text** are hardcoded arrays. **Replace with real output from the Rust `analysis` module** (see OVERVIEW §10–11).
- The **piece-slide animation** (`_animateMove`) diffs two positions to find the moving piece and tweens a cloned sprite. Re-implement equivalently in Svelte (see §6.4).

---

## 2. Fidelity

**HIGH FIDELITY (hifi).** This is a pixel-perfect mockup with final colors, typography, spacing, radii, shadows, and interactions. Recreate the UI **1:1**. Do not "improve," restyle, re-space, or substitute components. When a value is ambiguous, open `reference/SecondBoard.dc.html` and read the literal inline style.

---

## 3. Target architecture (from OVERVIEW — implement this)

```
Frontend UI (SvelteKit + Svelte 5, static adapter / SPA mode)
  ↓ Tauri invoke commands
Rust Backend (src-tauri)
  ↓
SQLite (sqlx or rusqlite)      Stockfish process (UCI)
```

- **Desktop shell:** Tauri v2. Targets: Windows (NSIS) + Linux AppImage first; macOS later.
- **Frontend:** SvelteKit + Svelte 5, **`@sveltejs/adapter-static`** (Tauri cannot serve SSR — SPA/static only).
- **Backend:** Rust. Modules: `engine`, `analysis`, `pgn`, `chesscom`, `db`, `insights`, `settings`, `updater` (see OVERVIEW §8).
- **DB:** SQLite. Schema in OVERVIEW §9 — implement those tables verbatim.
- **Chess logic:** `shakmaty` for FEN/SAN/legal moves. **Do not ship the prototype's JS SAN parser** — it is a mock.
- **Engine:** bundled Stockfish per platform, driven over UCI (OVERVIEW §6.6, §10).
- **Charts:** eval graph / trend charts are hand-drawn SVG in the reference (see §5). You may keep them as SVG components or move to ECharts — but the **visual result must match**. Simplest 1:1 path is to port the SVG path-generation math (documented in §6.3) into Svelte.

Suggested frontend module layout (from OVERVIEW §8.2):
```
src/
  routes/                 # one route per screen (see §5)
  lib/
    components/            # Sidebar, TitleBar, Board, EvalBar, EvalGraph, MoveList, CoachCard, StatCard, ...
    stores/               # app state (screen nav, current ply, flip, sidebar collapse, theme)
    api/                  # Tauri invoke wrappers (analyze_fen, import_pgn, get_game, ...)
    board/                # Board component + piece sprites + arrow/animation logic
    charts/               # EvalGraph, RatingTrend, SkillRadar
    types/                # TS types mirroring the DB rows
```

---

## 4. Design tokens (EXACT — use these values verbatim)

### 4.1 Typography
- **Primary font:** `Geist` (weights 300, 400, 500, 600, 700, 800). Fallback: `-apple-system, system-ui, sans-serif`.
- **Monospace font:** `Geist Mono` (weights 400, 500, 600), used for all numbers/stats/clocks/SAN/eval. Fallback: `ui-monospace, monospace`. Apply `font-feature-settings: 'tnum' 1;` (tabular numerals) — this is the `.sbmono` class in the reference.
- Load via Google Fonts: `family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600`. **For a local-first desktop app, self-host these fonts** (download WOFF2 and bundle) rather than hitting Google at runtime — the app must work offline.
- Body: `-webkit-font-smoothing: antialiased`. `* { box-sizing: border-box; }`.

### 4.2 Core color palette
| Role | Hex |
|---|---|
| App background (root) | `#07080C` |
| Sidebar gradient | `linear-gradient(180deg,#0D0F17,#0A0B12)` |
| Title bar gradient | `linear-gradient(180deg,#111420,#0C0E16)` |
| Card / panel bg | `#14161F` |
| Panel bg (right review panel) | `#101219` |
| Inset / nested card bg | `#0F1119` |
| Deep inset (textarea, board frame) | `#0B0C12` |
| Bottom bar bg | `#0C0E15` |
| Text primary | `#F3F4F8` / `#E3E6EE` |
| Text secondary | `#C7CCDA`, `#B8BDCC`, `#9298A8`, `#9AA0B0` |
| Text tertiary / labels | `#8A90A0` |
| Text muted | `#6B7180`, `#565C6B` |
| Hairline borders | `rgba(255,255,255,.05)` → `.08` |

### 4.3 Accent colors
| Role | Hex |
|---|---|
| Primary accent (green) | `#4ADEA0` |
| Teal (brilliant / eval midline / logo) | `#2DE0CE` |
| Light green highlight | `#8FE9C2`, `#86E5A8`, `#5EF0DE` |
| Link hover green | `#74ECBC` |
| Blue | `#60A5FA` (also `#3B82F6`, `#6366F1` for gradients) |
| Purple | `#A78BFA` (also `#8B5CF6` gradient, `#C77DFF` for "miss") |
| Amber / warning | `#F5B14C` |
| Orange (mistake) | `#F97A45` |
| Red (blunder / loss) | `#F26B6B` |

Common gradients:
- Primary CTA: `linear-gradient(135deg,#4ADEA0,#2DE0CE)` (text color on it: `#062018`).
- Blue CTA: `linear-gradient(135deg,#3B82F6,#6366F1)`.
- Purple CTA: `linear-gradient(135deg,#A78BFA,#8B5CF6)`.
- Logo mark: `linear-gradient(140deg,#2DE0CE,#3B82F6 55%,#A78BFA)`.

### 4.4 Board colors
- Light square: `#5B5473`. Dark square: `#37344A`.
- Last-move highlight: overlay `#4ADEA0` at ~32% alpha (`…52` hex) — actually tinted by the move-classification color of the current move.
- Eval bar track: `#26232E`; white fill gradient `#F4F5FA → #DDE1EC`; midline `rgba(45,224,206,.5)`.
- Coordinate labels: `rgba(255,255,255,.30)` on dark squares, `rgba(20,20,30,.34)` on light squares, 11px, weight 600.

### 4.5 Radii, shadows, spacing
- Card radius: **15–16px**. Inset cards: **11–14px**. Buttons/controls: **9–12px**. Pills/badges: **20px** (fully round). Icon chips: **8–10px**. Board: **12px**.
- Sidebar width: **236px** expanded, **70px** collapsed (transition `width .2s ease`).
- Right review panel width: **404px** (fixed).
- Title bar height: **38px**. Nav row padding `9px 11px`, gap `11px`.
- Board shadow: `0 20px 60px rgba(0,0,0,.5)`. CTA glow: `0 8px 22px rgba(74,222,160,.3)`.
- Scrollbar (`.sbscroll`): 9px, thumb `#262A38` (hover `#363B4E`), radius 20px, 2px transparent padding-box border.

### 4.6 Keyframe animations
- `bpulse` (brilliant-move square ring): 2.4s ease-in-out infinite, box-shadow pulses teal `rgba(45,224,206,…)`.
- `softfloat`: `translateY(0 → -3px → 0)`.
- Piece slide: `transform .17s cubic-bezier(.33,.9,.35,1)`.
- Eval-bar fill: `height .25s ease`.

---

## 5. Move classification system (EXACT visual spec)

Ten categories. Each has a name, a short "coach word", a color, and a glyph. **Reuse these exactly** (badges appear on the board, in the move list, in the breakdown table, and on the eval graph dots). Mirrors OVERVIEW §11.2 / §17.4.

| Code | Name | Coach word | Color | Glyph |
|---|---|---|---|---|
| `brilliant` | Brilliant | "brilliant" | `#2DE0CE` | `!!` |
| `great` | Great | "a great move" | `#60A5FA` | `!` |
| `best` | Best | "the best move" | `#4ADEA0` | `★` (U+2605) |
| `excellent` | Excellent | "excellent" | `#86E5A8` | `✦` (U+2726) |
| `good` | Good | "a good move" | `#8FB39B` | `✓` (U+2713) |
| `book` | Book | "a book move" | `#C99B6E` | `◈` (U+25C8) |
| `inaccuracy` | Inaccuracy | "an inaccuracy" | `#F5B14C` | `?!` |
| `mistake` | Mistake | "a mistake" | `#F97A45` | `?` |
| `miss` | Miss | "a miss" | `#C77DFF` | `✕` (U+2715) |
| `blunder` | Blunder | "a blunder" | `#F26B6B` | `??` |

Badge rendering:
- **On board** (destination square): 36px circle, weight 900, 19px glyph, white text, `box-shadow:0 3px 9px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.22)`, bg = category color, top-right of the to-square.
- **In move list:** 16px circle, 8.5px glyph, white text.
- **In breakdown table:** 21px circle, 10.5px glyph. For light-colored categories (`brilliant, best, excellent, good, book, inaccuracy`) use **dark** text `#0B120F`; otherwise white.
- **Brilliant move** also draws an animated `bpulse` ring (`inset:5px; border-radius:9px; border:2px solid rgba(45,224,206,.9)`) on its square.

Coach card body text per category is in the `coachTextMap` object of the reference — copy those strings verbatim as the template-comment fallback (OVERVIEW §21.4 covers replacing these with real computed templates later).

---

## 6. Screens & components (1:1 layout spec)

The app is a **fixed full-viewport shell**: `100vw × 100vh`, `#07080C`, `display:flex; flex-direction:column; overflow:hidden`. Top = title bar (38px). Below = a flex row: **Sidebar** (left) + **main content** (scrollable, `flex:1`).

Navigation is client-side screen switching (a `screen` state value), not URL routing in the prototype — in SvelteKit, implement as routes OR a single-page store-driven switch; the visual result is identical. Screens present in the reference:

- `home` → **Dashboard**
- `review` (with `gameLoaded=false`) → **Onboarding / Paste PGN**
- `review` (with `gameLoaded=true`) → **Game Review** (the primary screen)
- `openings` → **Opening Explorer**
- `insights` → **Insights & Weakness Timeline**
- `training` → **Training**
- `games`, `sessions`, `stats`, `settings` → **nav items exist but screens are NOT designed in the prototype.** Build the nav entries; these screens are described only in the OVERVIEW (§16.3, §16.7, §16.8) — implement them from the OVERVIEW spec later, matching the established visual language. Flag them as out-of-scope for the 1:1 recreation.

### 6.1 Persistent chrome

**Title bar (38px):** three 11px grey dots (`#3A3F4E`, decorative window controls) at left; centered title "SecondBoard — Local Chess Review Companion" (12px, `#6B7180`, letter-spacing .04em); right side: a "Local · Offline" pill (green dot `#4ADEA0` w/ glow, bg `rgba(74,222,160,.10)`, border `rgba(74,222,160,.22)`, text `#8FE9C2` 10.5px) + version `v0.4.1` in mono `#565C6B`. In Tauri, wire the dots to real `getCurrentWindow().close()/minimize()/toggleMaximize()` and set `decorations:false` for a custom title bar (or keep native decorations and drop the dots — but the reference shows a custom bar).

**Sidebar (236px / 70px collapsed):** vertical flex, `linear-gradient(180deg,#0D0F17,#0A0B12)`, right border hairline, padding `18px 14px`.
- Header: 38px rounded logo mark (gradient `140deg,#2DE0CE,#3B82F6 55%,#A78BFA`, inner `#0B0C12` cutout with two 9px teal/purple squares), then "SecondBoard" (16px/700) + "Chess Review Lab" (10.5px/`#565C6B`); a 26px collapse toggle button (chevron icon swaps direction on collapse).
- Nav list (9 items), each: 18px stroke icon + label, `padding:9px 11px`, radius 11px, gap 11px. **Active item:** bg `linear-gradient(135deg,rgba(74,222,160,.14),rgba(74,222,160,.04))`, text `#EAF6F0`, `inset 0 0 0 1px rgba(74,222,160,.2)`, icon stroke `#4ADEA0`. **Inactive:** text `#9298A8`, icon stroke `#6B7180`. Collapsed = center icons only.
  Nav items + their icon `d` paths (copy exactly from the reference `nav` array): Home, Game Review, Games, Openings, Insights, Training, Sessions, Stats, Settings.
- Spacer (`flex:1`).
- "Chess.com sync" card (only when expanded): label + green "Synced" dot, full progress bar (`#2DE0CE→#4ADEA0`), "247 games indexed" / "2m ago".
- Profile row: 34px gradient avatar "J" (`135deg,#3B82F6,#A78BFA`), "Jonas" / "Rapid 1867", chevron.

### 6.2 Onboarding (Paste PGN) — `screen=review & !gameLoaded`
Centered column, max-width 760px.
- 52px logo mark (same style, larger), then heading "Review your chess game" (30px/700, letter-spacing -.02em), subtitle (15px/`#8A90A0`, max-width 520px): "Paste a PGN to start a local game review. Every move is classified and analyzed on your machine — nothing leaves your device."
- PGN card (`#101219`, border hairline, radius 16px, padding `16px 16px 14px`): header row "PGN" label + "Paste sample game" link (green, clipboard icon). A `<textarea>` (190px tall, `#0B0C12`, mono 13px, `#D7DBE6`, placeholder shows a sample header). Below: **"Start Review"** primary CTA (flex:1, green gradient, `#062018` text, arrow icon) + **"Upload .pgn"** secondary button (`#1B1E2A`, border hairline, download icon).
- Footer line: green dot + "Local · Offline — analysis runs entirely on this device."
- Behavior: "Paste sample game" fills the textarea with a sample PGN (string in `pasteSample`). "Start Review" sets `gameLoaded=true, screen=review, ply=31, tab=analysis`. In the real app: parse the pasted PGN via Rust `pgn` module, persist, enqueue analysis, then open the review.

### 6.3 Game Review (PRIMARY SCREEN) — `screen=review & gameLoaded`
Two columns, `gap:14px`, full height, `padding:12px 14px`.

**Left column (`flex:1`) — board area:**
1. **Top player row:** avatar (34px) + name (15.5px/600) + rating (mono 12px `#6B7180`); below, captured-piece icons (18px sprites) + material advantage (`+N`, mono `#8FE9C2`). Right side: **"New PGN"** button (resets to onboarding) + a clock chip. The **active side's clock** is highlighted (`rgba(45,224,206,.12)`, `#5EF0DE`, inset teal ring); inactive is `#14161F`/`#6B7180`.
2. **Eval bar + board:** a 20px vertical eval bar (track `#26232E`, white fill height = `whitePct`, midline teal, tiny eval label) + the **board** in a `container-type:size` wrapper sized `100cqmin` square, radius 12px, board shadow.
   - Board = 8×8 CSS grid. Squares light `#5B5473` / dark `#37344A`. Rank labels on the left file, file labels on the bottom rank (flip-aware). Last-move squares get a translucent overlay tinted by the current move's class color. Destination square shows the class **badge**. Brilliant square shows the `bpulse` ring.
   - **Best-move arrow:** an absolutely-positioned SVG (`viewBox 0 0 600 600`) drawn only when the played move was *not* best (categories inaccuracy/mistake/miss/blunder). Arrow is teal `#4ADEA0` at 0.82 opacity; **knight moves bend at a right angle** (L-shaped). Geometry math is in `arrowGeom`/`center` — port it: each square is 75 units (600/8), center = `col*75+37.5`; flip inverts file/rank ordering.
3. **Bottom player row:** mirror of top (the side shown at bottom depends on `flipped`; default white at bottom).

**Right column (404px) — tabbed review panel** (`#101219`, radius 16px):
- Header: 23px green star badge + "Game Review" title + a sound-icon button + a **flip-board** button.
- Tab bar (4 tabs): **Analysis, Review, Details, Explore**. Active tab bg `rgba(74,222,160,.1)`, text `#EAF6F0`.
- **Analysis tab** (default): pinned **coach card** (bg is a radial tint of the current move's class color + `#14161F`, border = class color at 44 alpha) showing the class badge, "`<move>` is `<coach word>`", eval chip, and coach text; a "Best was `<san>`" strip when applicable. Then an **Explain / Next** button pair. Then the **move list**: two-column grid (white move | black move) with move-number gutter, each cell shows the class badge + SAN in mono, selected ply highlighted teal; auto-scrolls the selected row into view.
- **Review tab:** an **eval graph** (SVG, see below), a players+accuracy block (name over avatar, accuracy chips: Jonas 82.6, DominikP 89.1), a **move-category breakdown table** (grid `88px 1fr 36px 1fr`: category name | white count | badge | black count), a **Game Rating** row (1712 vs 1994), and a **game-phase** table (Opening/Middlegame/Endgame with per-side badges).
- **Details tab:** key-value list (Event, Time control 10+0, Date 2024.05.14, Opening "Italian Game · C50", Moves 41, Analyzed "Locally · 100%") + a reassurance note.
- **Explore tab:** "Explore this opening" card → 61% win rate → "Open in Opening Explorer" (navigates to `openings`).
- **Shared bottom bar** (shown on all tabs except Review, since Review has its own graph): the **eval graph** again + a **navigation control row** (First / Prev / big Play / Next / Last). Prev/Next also bound to ArrowLeft/ArrowRight keys.

**Eval graph** (`viewBox 0 0 660 78`): bg `#20222E`; white filled area under the eval line; dashed teal midline at y=39; a faint grey eval line; a vertical teal marker at the current ply; colored dots at *notable* plies (brilliant/great/excellent/inaccuracy/mistake/miss/blunder) using class colors; a teal current-ply dot. X = `i/(n-1)*660`; Y = `39 - clamp(v,-5,5)/5*34`. Port this math (`evalGraph`).

### 6.4 Piece-slide animation (behavior spec)
On single-step ply change (only when `|Δply|===1`, same screen, same flip, game loaded): diff the previous and current piece maps to find the from/to squares of the traveling piece (prefer the from/to pair carrying the same piece — robust for captures, castling, promotions), clone the landing piece sprite, position it over the from-square, hide the real landing sprite, then transition `transform` to the to-square delta over `.17s cubic-bezier(.33,.9,.35,1)`; remove clone + un-hide on transitionend (with a 300ms safety timeout). Re-implement in Svelte with an `$effect` watching ply, or via FLIP. **Do not animate multi-step jumps (First/Last).**

### 6.5 Dashboard — `screen=home`
Header: date line + "Welcome back, Jonas." (27px/700) + streak line; right: "View all stats" + "Sync Chess.com" (blue gradient) buttons.
- **4 stat cards** (grid, gap 14): Games analyzed **247** (+18), Rapid rating **1867** (+41), Accuracy 30d **88.7%** (+2.1), Best streak **12** (amber-tinted card). Each: 28px icon chip + label + big mono number + delta line.
- **Row (1.55fr / 1fr):** "Rating & accuracy trend" chart card (SVG line chart, blue rating line w/ gradient fill + dashed green accuracy line, gridlines at y=40/93/146, month labels Apr–Jul; paths from `chartPaths`) + "What changed" insight feed (4 colored-dot items).
- **Row (1.55fr / 1fr):** "Recent games" list (result chip W/L, "vs opponent", meta, accuracy, chevron; `recent()` data) + "Current training focus" card (purple-tinted, "Knight forks under pressure", 56px progress ring 56%, "Continue training" CTA → training).

### 6.6 Opening Explorer — `screen=openings`
Header "Opening Explorer" + subtitle. Grid `340px / 1fr`.
- **Left:** "Your repertoire" card listing openings by win rate (`openingsList()`: Italian 61%, Scotch 58%, Queen's Gambit 54%, Sicilian 48%, French 42%), each a mini card with a colored win-rate bar; selected = green-tinted.
- **Right:** large "Italian Game" hero card (green radial tint) with 4 stat tiles (61% win rate, +0.42 avg eval move 10, 75 games, 12.8 avg out-of-book) + "Study this line" CTA; below, a "Main line · frequency & success" card (`treeRows()`: bars per move with frequency % + win-rate) with two takeaway notes (✓ green, ! amber); and a **mini board** card showing position after 3.Bc4 (`miniPos`, 24px pieces) with the line in mono.

### 6.7 Insights & Weakness Timeline — `screen=insights`
Header + tagline "Stockfish knows the position. SecondBoard knows how **you** play it." Grid `360px / 1fr`.
- **Left:** "Skill profile" **radar chart** (SVG 220×220, 8 axes: Opening, Tactics, Calc., Conv., Defense, Endgame, Time, Consist.; two polygons — current teal `#4ADEA0`, 30-days-ago dashed grey; concentric rings at 34/67/100%; axis labels). Math in `radar()`: center (110,110), R=78, angle `i*45-90°`.
- **Right (stacked):** two insight cards — amber "Time management is your biggest weakness" (Confidence: High pill, "2.4× more often", stat trio 184 / 2.4× / <30s) and green "Your endgames are getting sharper" (Confidence: Medium, 73%→84%, stats 42 / +11% / 30d).
- **Full-width:** "Weakness timeline" — horizontal 4-node timeline (`timelineRows()`: January Tactics weak, February Opening improved, March Time pressure, April Endgames sharper), each node a glowing colored dot + month + colored tag pill + note; connecting line behind the dots.

### 6.8 Training — `screen=training`
Header "Train from your own mistakes" + subtitle. 
- **5 category cards** (`trainCategories()`): Knight Forks 14 (8/14, purple, selected), Winning Positions Lost 9, Time-Pressure Blunders 22, Endgame Technique 7, Opening Mistakes 18. Each: icon chip + solved count + big number + name.
- Grid `440px / 1fr`:
  - **Left:** current puzzle card — "Knight Fork" pill + "Black to move", then a **board** (`trainPos`, 40px pieces) with purple **hint dots** on suggested squares (`inset:34%` circle, purple glow).
  - **Right (stacked):** "Your position · lost this thread" card (purple radial tint): "Find the move you missed.", context text, 3 info tiles (Theme / Difficulty / Source), and a button row (**Try Move** purple CTA, **Reveal Hint**, **Show Solution**). Below: "Spaced repetition" card — 3 stat tiles (8 solved / 4 learning / 2 due today) + a 14-cell progress strip (`srs()`: green=solved, amber=learning, grey=due) + "14-position deck · next review in 2 days".

---

## 7. State model (from the prototype `Component`)

Global UI state to recreate (Svelte store or root `$state`):
```
screen: 'home'|'review'|'openings'|'insights'|'training'|'games'|'sessions'|'stats'|'settings'   // default 'review'
ply: number            // current half-move index, default 31 (0 = start position)
tab: 'analysis'|'review'|'details'|'explore'   // right-panel tab, default 'analysis'
flipped: boolean       // board orientation, default false (white at bottom)
sidebarCollapsed: boolean   // default false
gameLoaded: boolean    // false → onboarding, true → review screen; default false
pgnText: string        // onboarding textarea contents
showLines, selfAnalysis: boolean  // toggle switches (present, wired to track/knob styles)
```
Keyboard: ArrowLeft = ply−1, ArrowRight = ply+1 (only on review screen; clamp 0..moveCount).

Derived per-ply data the UI consumes (produced by mock functions today, by the Rust backend tomorrow):
- current piece map (`positions[ply]`), last-move squares, captured pieces + material advantage, current move SAN + classification + coach text + eval, best-move arrow geometry, eval-graph paths + dots + marker, move-list rows, breakdown counts, phase badges.

---

## 8. Mapping mock data → real backend (per OVERVIEW)

Everything hardcoded in the prototype has a real source. Wire these Tauri commands / DB reads:

| Prototype mock | Real source (OVERVIEW ref) |
|---|---|
| `sanList`, `buildGame`/`applySan` (positions per ply) | `pgn` module: parse PGN, emit SAN/UCI + FEN before/after per ply; `moves` table §9. Use `shakmaty`, not the JS parser. |
| `classCodes`, `CLS` categories | `analysis` + `move_classifications` table §9; thresholds §11.3–11.9. |
| `evalPerPly`, `bestMoves`, engine lines | `engine` (Stockfish UCI) + `engine_analysis` table §9; eval normalized to mover's POV. |
| `coachTextMap` strings | Deterministic template comments §21.4 (LLM optional, later, §21). |
| Accuracy (82.6 / 89.1), Game Rating | §12 accuracy formulas. |
| Dashboard stats, trend chart, insight feed | `insights` + `player_metric_snapshots` tables §9; §13–14. |
| Opening Explorer data | `insights`/queries over the user's games §16.4, §13.4. |
| Training categories, puzzle, SRS | `training_positions` table §9; §15. |
| Chess.com sync card | `chesscom` module (PubAPI) §18. |
| "Local · Offline", version pill | local-first guarantee §25.5; `updater` §6.10. |

**Analysis truth = Stockfish + deterministic rules. Never let an LLM decide moves/classifications/eval** (OVERVIEW §21.1).

---

## 9. Assets & licensing

- **`reference/piece_sprites/*.svg`** — the 12 board pieces (Cburnett/Wikimedia-style standard SVG set), extracted verbatim from the design. In the prototype they are inlined as `url("data:image/svg+xml,…")` background images at `background-size:90%`. White pieces get `drop-shadow(0 2px 2px rgba(0,0,0,.4))`; black pieces get `drop-shadow(0 0 1.4px rgba(255,255,255,.45)) drop-shadow(0 2px 2px rgba(0,0,0,.5))`. Reuse them 1:1 as a `Board` component's piece set. (This is the well-known Cburnett set, CC BY-SA — verify attribution requirements before shipping; OVERVIEW §17.3 anticipates multiple piece sets.)
- **Fonts:** Geist + Geist Mono (SIL OFL) — self-host for offline use.
- **Icons:** all icons are inline stroke SVG `<path>` (Lucide/Feather-style), `stroke-width` ~1.9–2.2, `stroke-linecap/linejoin=round`. Copy the exact `d` strings from the reference (nav array, tab array, button icons). No icon-font dependency.
- **Stockfish binaries:** not included — bundle per platform per OVERVIEW §6.6.

---

## 10. Files in this package

```
design_handoff_secondboard/
  README.md                         ← UI spec (tokens, screens, components) — this file
  LOGIC.md                          ← behavior spec (state, algorithms, animation, backend contract, porting notes)
  SecondBoard_PROJECT_OVERVIEW.md   ← product + architecture ground truth
  reference/
    SecondBoard.dc.html             ← authoritative visual + interaction reference (read as markup+logic, DO NOT port the runtime)
    logic/                          ← prototype logic extracted into runtime-free ES modules
      chess-mock.js                 ← MOCK SAN→position engine (replace with Rust/shakmaty; documents data shape)
      view-math.js                  ← pure SVG/geometry helpers (arrow, eval graph, radar, trend, captures) — reusable as-is
      data.js                       ← CLS classification spec (keep) + all mock screen content (replace with backend queries)
    piece_sprites/                  ← 12 chess piece SVGs, verbatim
      white_king.svg  white_queen.svg  white_rook.svg  white_bishop.svg  white_knight.svg  white_pawn.svg
      black_king.svg  black_queen.svg  black_rook.svg  black_bishop.svg  black_knight.svg  black_pawn.svg
    screens/                        ← rendered reference screenshots (pixel target)
      1-onboarding-paste-pgn.png            5-opening-explorer.png
      2-game-review-analysis-tab.png        6-insights-weakness-timeline.png
      3-game-review-review-tab.png          7-training.png
      4-dashboard-home.png
```

---

## 11. Recommended build order (vertical slice first — OVERVIEW §24)

1. Scaffold **Tauri v2 + SvelteKit + adapter-static**; self-host Geist fonts; set root theme tokens (§4).
2. Build **persistent chrome** (TitleBar + Sidebar) and the **screen switcher**.
3. Build the **Board** component (grid, piece sprites, coordinates, flip, last-move highlight, class badges, best-move arrow, slide animation) — this is the heart of the product.
4. Build the **Game Review** screen with **mock data first** (reuse the reference's structure) so the UI is pixel-verified before the engine exists.
5. Add Rust `analyze_fen` + Stockfish UCI; replace eval/best-move mocks with real data.
6. Add `pgn` parse (shakmaty) + move navigation; replace the JS SAN engine.
7. Add SQLite persistence (§9) + settings.
8. Build Dashboard, Opening Explorer, Insights, Training against real aggregates (§13–16).
9. Chess.com sync (§18), packaging + updater (§6.9–6.10, §26).

Verify each screen against `reference/SecondBoard.dc.html` at every step — **1:1, zero visual deviation.**
