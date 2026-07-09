# LOGIC.md — Behavior, algorithms & porting guide

Companion to `README.md`. The README covers *what it looks like*; this covers *how it works* and *how to rebuild the behavior* in Tauri v2 + SvelteKit/Svelte 5 + Rust.

All code lives in `reference/SecondBoard.dc.html` inside `class Component extends DCLogic`. Because that class is written against a proprietary browser template runtime (`support.js`), the reusable parts have been **extracted into plain ES modules** under `reference/logic/`:

| File | What it is | Reuse policy |
|---|---|---|
| `reference/logic/chess-mock.js` | Minimal SAN→position interpreter (`standardBoard`, `applySan`, `canReach`, `clearPath`, `buildGame`) | **MOCK.** Documents data shape only. Replace with Rust `pgn`/`shakmaty`. |
| `reference/logic/view-math.js` | Pure SVG/geometry helpers (`center`, `arrowGeom`, `capturedInfo`, `evalGraph`, `radar`, `chartPaths`, `evalBarPct`) | **Reusable as-is** in the Svelte frontend. Feed real data. |
| `reference/logic/data.js` | `CLS` classification spec (keep) + all mock screen content (replace) | `CLS`/glyph/color spec = keep; content = replace with backend queries. |

> The single most important rule (OVERVIEW §21.1): **Stockfish + deterministic rules decide truth** (eval, best move, classification, accuracy). The frontend only *renders* that truth. Never let the mock JS — or any LLM — decide it.

---

## 1. Application state

The whole app is driven by one small state object (prototype `this.state`). Recreate as a Svelte store (`$state` in a `.svelte.ts` module, or a root layout `$state`).

```ts
type Screen = 'home'|'review'|'openings'|'insights'|'training'|'games'|'sessions'|'stats'|'settings';
type Tab = 'analysis'|'review'|'details'|'explore';

interface AppState {
  screen: Screen;        // default 'review'
  ply: number;           // current half-move, default 31; 0 = start position
  tab: Tab;              // right-panel tab, default 'analysis'
  flipped: boolean;      // board orientation, default false (White at bottom)
  sidebarCollapsed: boolean; // default false
  gameLoaded: boolean;   // false ⇒ onboarding, true ⇒ review; default false
  pgnText: string;       // onboarding textarea
  showLines: boolean;    // toggle (default true)
  selfAnalysis: boolean; // toggle (default false)
}
```

### Screen resolution (exact conditions from `renderVals`)
- `isHome        = screen==='home'`
- `isOnboard     = screen==='review' && !gameLoaded`  ← paste-PGN screen
- `isReview      = screen==='review' &&  gameLoaded`  ← game review screen
- `isOpenings    = screen==='openings'`
- `isInsights    = screen==='insights'`
- `isTraining    = screen==='training'`
- Right-panel tab: `isAnalysisTab / isReviewTab / isDetailsTab / isExploreTab`.
- `showBottomBar = tab !== 'review'` (the Review tab has its own inline eval graph, so the shared bottom eval-graph+controls bar is hidden there).

### Transitions (button/handler → state change)
| Trigger | Effect |
|---|---|
| Sidebar nav item | `screen = <id>` |
| Collapse toggle | `sidebarCollapsed = !sidebarCollapsed` |
| "Paste sample game" | `pgnText = <sample PGN string>` |
| "Start Review" | `gameLoaded=true; screen='review'; ply=31; tab='analysis'` |
| "New PGN" | `gameLoaded=false; pgnText=''; screen='review'` (→ onboarding) |
| Tab click | `tab = <id>` |
| Flip button | `flipped = !flipped` |
| Move-list cell click | `ply = <that ply>` |
| First / Prev / Next / Last | `ply = 0 / max(0,ply-1) / min(N,ply+1) / N` |
| Explore → "Open in Opening Explorer" | `screen='openings'` |
| Dashboard "Continue training" | `screen='training'` |

### Keyboard (review screen only)
`ArrowLeft → ply-1`, `ArrowRight → ply+1`, clamped to `[0, sanList.length]`. In the prototype a `keydown` listener is added in `componentDidMount` and removed in `componentWillUnmount`; guard so it only acts when `screen==='review'`. In Svelte: `$effect` that adds/removes a `window` listener, or `<svelte:window onkeydown={…}>` with the same guard. **`preventDefault()`** on the arrows so the page doesn't scroll.

---

## 2. The chess board (heart of the product)

### 2.1 Data shape
A position is a flat map `{ 'e4': ['P','w'], … }` (see `chess-mock.js`). In the real app, the Rust `pgn` module produces one position (or FEN) per ply plus the move's `{from,to}` squares; convert FEN→map on the frontend if you prefer maps. The board component only needs: **a position map, the last-move squares, the current move's classification, an optional best-move arrow, an optional destination badge, and `flipped`.**

### 2.2 Rendering (see README §4.4 / §6.3 for exact colors/sizes)
- 8×8 CSS grid, `grid-template-columns/rows: repeat(8,1fr)`.
- Rank/file order is **flip-aware**: unflipped ranks render `8→1`, files `a→h`; flipped reverses both. Coordinate labels: rank on the left-most file, file on the bottom-most rank (also flip-aware).
- Square color: `((f+r)%2===1)` → dark `#37344A`, else light `#5B5473`.
- Piece = a `<span>` with `background-image: url(<sprite>)`, `background-size:90%`, centered. Use the extracted `reference/piece_sprites/*.svg`. White pieces get `drop-shadow(0 2px 2px rgba(0,0,0,.4))`; black get `drop-shadow(0 0 1.4px rgba(255,255,255,.45)) drop-shadow(0 2px 2px rgba(0,0,0,.5))`.
- Last-move overlay: absolutely-positioned div, `background: <classColor>52` (hex alpha ≈ 32%).
- Classification badge: on the destination square, top-right (see README §5 for the three badge sizes).
- Brilliant ring: `position:absolute; inset:5px; border-radius:9px; border:2px solid rgba(45,224,206,.9); animation:bpulse 2.4s ease-in-out infinite`.

**Svelte suggestion:** a `<Board>` component taking props `{ position, lastMove, classCode, best, flipped, badge, showCoords, pieceSize }`. Compute the square list with `$derived` from `position` + `flipped` (port `buildBoard`). Emit a `move`/`selectSquare` event for training/interactive modes. Keep the arrow + slide animation *inside* `<Board>`.

### 2.3 Best-move arrow — `view-math.js → arrowGeom()`
Draw an overlay `<svg viewBox="0 0 600 600" preserveAspectRatio="none">` only when `NOT_BEST_CODES.includes(classCode)` and a `bestMoves[ply]` exists. Straight arrows for normal moves; **knight moves bend at a right angle** (the function returns an L-shaped `shaft` path). Stroke `#4ADEA0`, `stroke-width:11`, `opacity:.82`; the head is a filled `<polygon>` in the same color. `center(sq, flipped)` maps a square to its pixel center in the 600-unit space.

### 2.4 Piece-slide animation — prototype `_animateMove()`
Triggered on **single-step** ply change only (`Math.abs(cur-prev)===1`), same screen, same `flipped`, game loaded. Algorithm:
1. Diff previous vs current position maps → collect squares a piece **left** (`froms`) and **arrived on** (`tos`).
2. Pick the from/to pair carrying the **same piece** (robust across captures, castling, promotions); fall back to `froms[0]/tos[0]`.
3. Find the landing piece `<span>` on the to-square (skip coordinate-label spans — match the one whose `background-image` is set).
4. Clone it, absolutely position the clone over the **from**-square (`data-sb-clone`), hide the real landing span, force reflow, then transition `transform: translate(dx,dy)` over `.17s cubic-bezier(.33,.9,.35,1)`.
5. On `transitionend` (or a 300ms safety timeout) remove the clone and un-hide the real span.
6. Multi-step jumps (First/Last, move-list clicks that skip) **do not animate** — the position just snaps.

**Svelte suggestion:** an `$effect` on `ply` that captures the previous ply, or a FLIP transition. If you use a keyed `{#each}` over pieces with a stable id per piece, Svelte's `animate:flip` gives you this for free on single-step changes — but you must **suppress it on multi-step jumps** (set `duration: 0` when `|Δply|>1`) to match the prototype. Castling moves two pieces; only the king (or the main traveller) is tweened in the prototype — matching FLIP on both rook+king is acceptable and arguably nicer, but if you want 1:1, animate only the primary traveller.

### 2.5 Captured material + eval bar
`view-math.js → capturedInfo(position)` returns `{whiteCap, blackCap, adv}` by diffing against the starting army (piece values P1 N3 B3 R5 Q9). Render captured pieces as 18px sprites; show `+adv` in mono `#8FE9C2` for the side that's up. `evalBarPct(evNum)` gives White's fill fraction (clamped ±44 around 50). Bar fill grows from the bottom when White is at the bottom, from the top when flipped; transition `height .25s ease`.

---

## 3. Charts (all hand-drawn SVG — reusable via `view-math.js`)

### 3.1 Eval graph — `evalGraph(evalPerPly, classCodes, CLS, ply)`
`viewBox 0 0 660 78`. White filled area under the line; dashed teal midline at y=39; faint grey eval line; vertical teal marker at current ply; colored dots at *notable* plies (brilliant/great/excellent/inaccuracy/mistake/miss/blunder) tinted by class color; teal current-ply dot. Appears twice: inline in the Review tab (`height 66`) and in the shared bottom bar (`height 62`) — same paths, different SVG height.

### 3.2 Skill radar — `radar(radarCats)`
`viewBox 0 0 220 220`, center (110,110), R=78, 8 axes at `i*45-90°`. Three concentric rings at 34/67/100%; axis spokes; a dashed grey baseline polygon (30 days ago) and a solid teal current polygon with dots; labels offset to R+14 with anchor chosen by horizontal position. Feed `[label, current, baseline]` triples.

### 3.3 Dashboard trend — `chartPaths(ratingY, accY)`
`viewBox 0 0 640 186`. Blue rating line (`#60A5FA`, width 2.4) with gradient area fill (`rgba(96,165,250,.22)→0`), dashed green accuracy line (`#4ADEA0`, `stroke-dasharray:1 5`), three gridlines at y=40/93/146, a blue end dot. The prototype passes **pre-scaled pixel Y arrays**; in the real app, map real rating/accuracy ranges to those pixel bands (lower pixel value = higher on screen) — or switch to ECharts (OVERVIEW §6.7) as long as the visual matches.

> These functions are stack-agnostic and safe to import directly into Svelte components. Only the *inputs* change from mock arrays to real backend data.

---

## 4. Move list, breakdown, phases (Analysis/Review tabs)

- **Move list** (`moveRows`): 16 rows, grid `30px 1fr 1fr` (number | white | black). Each cell = class badge (16px) + SAN (mono). Selected ply: bg `rgba(45,224,206,.14)`, text `#5EF0DE`, inset teal ring. Odd rows get a faint `rgba(255,255,255,.022)` stripe. Clicking a cell sets `ply`. **Auto-scroll:** after render, scroll the selected row to the top of the list container (prototype `_syncMoveScroll` measures `getBoundingClientRect` delta and adjusts `scrollTop` inside a `requestAnimationFrame`; **do not use `scrollIntoView`** — replicate with a manual `scrollTop` adjustment or `element.scrollTo`).
- **Breakdown table** (`breakdown` in data.js): grid `88px 1fr 36px 1fr` — category name | white count | 21px badge | black count. Counts colored by class color; badge fg dark for `DARK_FG_CODES`, else white.
- **Game Rating** row: White 1712 vs Black 1994 (mono chips).
- **Phase table** (`phases`): Opening/Middlegame/Endgame, a 22px badge per side.
- **Accuracy block** (Review tab): name over avatar over an accuracy chip (Jonas 82.6 neutral chip; DominikP 89.1 green-tinted, teal-ringed avatar). Accuracy formula in OVERVIEW §12.

---

## 5. Coach card (Analysis tab)
Derived from the current ply's class:
- `coachMove` = e.g. `"16. Ne5"` (white) / `"15... d5"` (black) — built from `Math.ceil(ply/2)` + `'. '`/`'... '` + SAN; `"Start"` at ply 0.
- Title line: `<move> is <CLS[code].word>` with the word colored by class color; eval chip on the right.
- Body: `coachTextMap[code]` (data.js); at ply 0 a "The game begins…" intro.
- Card background: `radial-gradient(120% 130% at 12% 0%, <classColor>1f, transparent 55%), #14161F` with border `<classColor>44`.
- "Best was `<san>`" strip only when `bestMoves[ply]` exists.

Real app: replace `coachTextMap` with deterministic template strings filled from analysis data (OVERVIEW §21.4), e.g. `"This move loses {cpLoss} cp. Better was {bestSan}, keeping the eval at {evalBest}."`. Optional local LLM prose comes later and only *rephrases* computed facts (§21.1–21.3).

---

## 6. Toggle switches (`track`/`knob` helpers)
Pill track 34×18, radius 20; knob 14×14 offset `2px`→`18px`; on = track `#2DE0CE`, knob `#062018`; off = track `#2A2E3C`, knob `#8A90A0`; transitions `.2s`. Used for `showLines` / `selfAnalysis`. Build as a small `<Toggle bind:checked>` Svelte component.

---

## 7. Backend contract (what the frontend calls)

Define Tauri commands (Rust `#[tauri::command]`, invoked from `lib/api`) that return exactly the shapes the mock produces. Minimum for the review vertical slice (OVERVIEW §24):

```
import_pgn(pgn: String) -> GameId
get_game(id) -> { meta, players, sanList, positions[]/fens[], moveMeta[] }
analyze_game(id, mode) -> stream of progress events, then per-move:
    { ply, evalCp, classification, bestMoveUci, bestMoveSan, pv[], cpLoss }
get_game_review(id) -> { accuracyWhite, accuracyBlack, gameRatingWhite,
                         gameRatingBlack, breakdown, phases, evalPerPly }
analyze_fen(fen, opts) -> { evalCp, bestMove, pv }   // Phase-0 spike
```
Dashboard/insights/openings/training pull from the aggregate tables in OVERVIEW §9 (`player_metric_snapshots`, `insights`, `training_positions`) via further commands. Stream long analyses with Tauri events and keep the UI responsive (OVERVIEW §25.4); cache by `engine_version/mode/depth/classification_version` (§10.5).

Classification thresholds, accuracy math, Miss/Great/Brilliant heuristics, reason codes → implement per OVERVIEW §11–13. The frontend never recomputes these.

---

## 8. What to build first (matches OVERVIEW §24 sprint)
1. Tauri v2 + SvelteKit + `adapter-static`; tokens + self-hosted Geist.
2. Chrome (TitleBar, Sidebar) + screen switch (§1 state).
3. `<Board>` (grid, sprites, coords, flip, highlight, badges, arrow via `view-math.arrowGeom`, slide animation §2.4).
4. Game Review screen wired to **mock data (data.js)** → pixel-verify against `reference/screens/2-*.png` and `3-*.png`.
5. Rust `analyze_fen` + Stockfish UCI; swap eval/best-move mocks for real data.
6. `pgn` parse via `shakmaty` + navigation; drop `chess-mock.js`.
7. SQLite persistence (§9) + settings.
8. Dashboard, Openings, Insights, Training against real aggregates.
9. Chess.com sync, packaging, updater.

Verify every screen against `reference/` at each step — **1:1, zero deviation.**
