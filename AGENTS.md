# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

<!-- AUTO-MANAGED: project-description -->
## Overview

**SecondBoard** — local-first chess review companion. SvelteKit 5 (runes) frontend embedded in a Tauri v2 desktop shell (Windows). "Local · Offline" positioning: no cloud backend. Stockfish runs locally via Tauri commands; PGN parsing is done in Rust with `pgn-reader`/`shakmaty`.

Key capabilities: paste/load a PGN → Rust parses it → Stockfish analyses each position → frontend renders the review screen with eval bar, move list, coach card, accuracy block, and classification badges.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: build-commands -->
## Build & Development Commands

Package manager: **pnpm**. Run from repo root.

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Vite dev server (frontend only — Tauri commands unavailable) |
| `pnpm exec tauri dev` | Full desktop app with Rust backend (needed for `parse_pgn` / `analyze_fen`) |
| `pnpm test` | Vitest (watch mode) |
| `pnpm test -- run` | Vitest single-run (CI mode) |
| `pnpm exec vitest run <path>` | Target a single test file |
| `pnpm check` | `svelte-kit sync && svelte-check` (TypeScript + Svelte types) |
| `pnpm lint` | ESLint over the whole repo |
| `pnpm format` | Prettier write |
| `pnpm build` | Production Vite build (static output for Tauri to embed) |
| `cd src-tauri && cargo test` | Rust unit tests (pgn.rs, engine.rs) |
| `cd src-tauri && cargo check` | Fast Rust compile check |

`extension/` and `server/ingest/` are independent Node projects with their own `package.json` and
`vitest.config.ts` — they are not covered by the root `pnpm test`/`pnpm check`/`pnpm lint`:

| Command | Purpose |
|---|---|
| `cd extension && pnpm test` | Extension unit tests (parse-analyze-frame, build-envelope, retry-queue) |
| `cd server/ingest && pnpm test` | Ingest server unit tests (validate, server, db) |
| `cd server/ingest && pnpm exec tsc --noEmit` | Ingest server type check |

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: architecture -->
## Architecture

```
SecondBoard/
├── src/
│   ├── routes/                   # SvelteKit shell (+layout.svelte, +page.svelte)
│   └── lib/
│       ├── components/           # One .svelte per UI piece + co-located *.test.ts
│       ├── stores/
│       │   └── app-state.svelte.ts  # Single $state singleton (appState) — all mutations via named fns
│       ├── game/
│       │   ├── review.ts         # Per-ply derivation, GameData/PlayerRowData types
│       │   ├── engine-analysis.ts   # Orchestrates Stockfish across positions → appState.evalPerPly/wdlPerPly/bestMoves
│       │   ├── notation.ts       # FEN/SAN helpers
│       │   ├── mock-data.ts      # Remaining mock fixtures (gated by game.isSample)
│       │   └── sample-pgn.ts     # Built-in sample game
│       ├── api/
│       │   ├── pgn.ts            # invoke('parse_pgn')
│       │   ├── engine.ts         # invoke('analyze_fen') → AnalyzeFenResult {eval_cp, best_move, wdl}
│       │   └── window.ts         # minimize/maximize/close
│       ├── board/
│       │   ├── types.ts          # Position, Move, PieceColor, PieceType
│       │   ├── geometry.ts       # capturedInfo, evalBarPct, pure math
│       │   └── pieces/           # SVG sprite map
│       ├── charts/
│       │   └── eval-graph.ts     # Pure SVG path math for eval graph
│       └── tokens.ts             # Design tokens (colors, classification glyph/color map, radii)
├── src-tauri/src/
│   ├── pgn.rs                    # PGN→positions (pgn-reader + shakmaty, mainline only, no RAV)
│   ├── engine.rs                 # Stockfish invocation, exposes WDL via UCI_ShowWDL
│   ├── lib.rs / main.rs          # Tauri command registration
├── design_handoff_secondboard/   # Design source of truth (NOT part of src/)
│   ├── README.md                 # Visual spec with §-numbered sections referenced in code
│   ├── SecondBoard_PROJECT_OVERVIEW.md  # Full product/arch spec (§11 classification, §12 accuracy)
│   ├── LOGIC.md                  # Pointers to reference JS prototype
│   └── reference/screens/*.png   # Full-screen mockups per app screen
├── extension/                    # Chrome extension (Manifest V3): captures chess.com Game
│   │                             # Review results and forwards them to server/ingest/. Own
│   │                             # package.json/vitest.config.ts — NOT part of the Tauri app.
│   └── src/
│       ├── content-script.js     # document_start; relays raw WS messages + pageUrl
│       ├── injected-page.js      # web-accessible; hooks page WebSocket to see analyze frames
│       ├── background.js         # service worker: parse → build envelope → POST to ingest
│       ├── parse-analyze-frame.js # strips metaData (may hold a live session token) before use
│       ├── build-envelope.js     # extractGameId(pageUrl) + buildEnvelope(...) → ingest payload
│       ├── retry-queue.js        # persists failed sends to chrome.storage.local, flushes later
│       ├── options.html/.js      # configure ingest URL, shared token, submittedBy name
│       ├── popup.html/.js        # action.default_popup: last-synced time (formatRelativeTime)
│       │                         # + pending retry-queue count
│       └── format-relative-time.js # formatRelativeTime(iso, now) -> coarse "N units ago" string
├── server/ingest/                # Standalone Node/TS ingest service for the capture pipeline.
│   │                             # Own package.json/tsconfig/vitest.config/Dockerfile — separate
│   │                             # deployable, not part of the pnpm workspace root scripts.
│   ├── server.ts                 # POST /ingest — token + payload validation, upsertGame, 500 on
│   │                             # storage failure (never throws unhandled in the async handler)
│   ├── validate.ts               # payload schema checks, incl. per-position numeric `ply`
│   ├── db.ts                     # SQLite persistence (data/calibration.sqlite)
│   └── index.ts                  # entrypoint
└── .superpowers/sdd/             # SDD task briefs, reports, and diff snapshots
    # docs/superpowers/{plans,specs}/ also holds dated design docs for larger features
    # (e.g. the calibration capture pipeline), alongside this task-N-report.md ledger
```

**Data flow**: PGN paste → `parse_pgn` (Rust) → `appState.game` (positions + moves) → `loadRealAnalysis()` → `analyze_fen` per position (Rust/Stockfish) → `appState.evalPerPly` + `appState.wdlPerPly` + `appState.bestMoves` → review screen components render.

**Calibration capture pipeline** (separate from the app above): chess.com Game Review WS frame →
`injected-page.js` → `content-script.js` (adds `pageUrl`) → `background.js` → `parse-analyze-frame.js`
(strips `metaData`, requires only `positions`) → `build-envelope.js` (`gameId`/`ply` derived, never
trusted from the frame) → POST `server/ingest/server.ts` → SQLite. Failed sends queue in
`retry-queue.js` and flush on next success/startup/install. `background.js` also updates the
toolbar action badge (pending retry-queue count) on every flush/enqueue and on startup/install;
`popup.html`/`popup.js` (the `action.default_popup`) reads `lastSyncedAt`/`retryQueue` from
`chrome.storage.local` to show last-synced time (via `format-relative-time.js`) and pending count.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: conventions -->
## Code Conventions

- **Svelte 5 runes only**: `$state`, `$derived`, `$props()` — no legacy `export let` or writable stores for component props. The one app-wide mutable store (`appState`) is a `$state` object in `app-state.svelte.ts`; components read via `appState.x` and mutate only through exported functions, except trivial UI toggles (`appState.tab = ...`).
- **Design tokens**: all colors/radii/gradients from `TOKENS` in `src/lib/tokens.ts` or CSS custom properties (`var(--color-*)`, `var(--radius-*)`, `var(--layout-*)`). Never hardcode hex colors in `<style>` if a token exists.
- **`GameData.isSample` gate**: features depending on data the real engine doesn't produce yet (classification, coach text, breakdown/phase tables) only render "real-looking" mock content when `game.isSample` is true. Non-sample games get explicit "not available yet" messaging (`UNCLASSIFIED_COACH_TEXT` pattern), never misleading mock numbers.
- **Mock vs real fallback**: prefer real parsed/computed data, fall back to `mock-data.ts` only when the real value is null/unavailable. Always comment why the fallback exists.
- **Real data status**: board positions, moves, eval-per-ply, WDL-per-ply, player names/ratings, best-move arrows are real. Classification, coach text, accuracy %, breakdown/phase tables, and game result (`Result` PGN tag) are still mock/unimplemented — do NOT wire to non-sample games without implementing the real computation.
- **Testing**: co-located `ComponentName.test.ts` next to `ComponentName.svelte`; pure-logic modules also get `*.test.ts` siblings. TDD is expected — tests describe behavior before/alongside implementation.
- **Rust**: doc comments on structs/functions reference design-handoff doc sections (e.g. `OVERVIEW §6.5`, `LOGIC.md §7`) for traceability. Apply the same to new Rust code.
- **Commit style**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). No AI co-author trailer.
- **SDD habit**: each iteration gets `task-N-brief.md` (spec) + `task-N-report.md` (what shipped) under `.superpowers/sdd/`; periodic `docs: update sdd ledger` commits.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: patterns -->
## Detected Patterns

- **WDL-first accuracy**: `engine-analysis.ts` prefers WDL-derived win% over the eval sigmoid when Stockfish reports WDL (`UCI_ShowWDL`). Classification in `review.ts` follows the same preference.
- **Classification icon source**: chess.com classification icons (not custom SVGs) — imported via `Icon.svelte` using `TOKENS.classification` glyph map.
- **Eval bar**: white-POV centipawns from Stockfish, converted to percentage via `evalBarPct()` in `geometry.ts`.
- **Best-move arrow**: "prospective" (next position's best move) always real; "retrospective" (what was played vs best) still mock, gated by `isSample`.
- **Static adapter**: `@sveltejs/adapter-static` — the SvelteKit output is a static bundle that Tauri serves. No SSR, no server routes.
- **Component catalog**: `src/lib/components/README.md` lists all components and their responsibilities.
- **Never trust the captured frame's own IDs**: in the calibration pipeline, `gameId`/`url`/`ply`
  are always derived locally (from the page URL / array index) rather than read off the chess.com
  WS payload, because the real payload doesn't reliably carry them — mirrors the existing
  `src/lib/calibration/har-extract.ts` convention.
- **Strip secrets before they leave the browser**: `parse-analyze-frame.js` unconditionally deletes
  `metaData` (which can carry a live session token) from parsed frames before any further handling.
- **Extension scripts using ES `import` need `type="module"`**: `popup.html`'s `<script>` tag must
  declare `type="module"` — a classic script tag silently fails to resolve `popup.js`'s
  `import { formatRelativeTime } from './format-relative-time.js'`.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: git-insights -->
## Git Insights

Recent work (Iteration 9 — WDL-based expected score):
- Stockfish WDL output (`UCI_ShowWDL`) parsed in `engine.rs` and threaded through `AnalyzeFenResult` → `appState.wdlPerPly` → accuracy/classification.
- Classification prefers WDL-derived win% over the eval sigmoid fallback.
- Arrow overlay opacity reduced for better visibility (`fix: reduce opacity of arrow overlay`).
- Chess.com classification icons adopted (`feat: use chesscom classification icons`).
- Real classification counts now shown in the breakdown (`feat: show real classification counts`).

New sibling feature — calibration capture pipeline (`extension/` + `server/ingest/`):
- Chrome extension captures chess.com Game Review WS frames and forwards them to a personal
  ingest server; built via design spec + plan under `docs/superpowers/{specs,plans}/`, then an
  SDD task sequence (`task-1..9-report.md`) and a `final-review-fix-report.md`.
- Post-review hardening fixed 4 whole-branch-review findings in one commit: the extension
  originally required fields (`gameId`, per-position `ply`) that don't exist in the real payload
  and so captured nothing; `gameId`/`ply` are now derived locally instead of trusted from the
  frame; `metaData` (live session token) is stripped before transmission; the retry queue now
  flushes after every successful new send, not just on browser restart; `POST /ingest` no longer
  crashes/hangs on a payload that violates the SQLite `positions` primary key.
- Toolbar popup added (`feat(extension): add toolbar popup showing last-synced status`):
  `popup.html`/`popup.js` show last-synced time and pending-sync count; `background.js` keeps the
  action badge text in sync with the retry-queue length; new pure `format-relative-time.js` module
  (with co-located test) backs the "N units ago" display.

Key architectural decisions visible in history:
- Rust PGN/engine replaced earlier JS mock (`mock-engine.ts` deleted; `LOGIC.md` says it must not ship).
- `isSample` gate introduced to prevent mock data leaking into real-game reviews.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: best-practices -->
## Best Practices

- **Task completion checklist** before marking any frontend change done:
  1. `pnpm exec vitest run` — all tests green, including new/updated tests.
  2. `pnpm check` — svelte-check/tsc clean.
  3. `pnpm lint` — no new ESLint errors.
  4. If Rust touched: `cargo test` + `cargo check` in `src-tauri/`.
  5. For visual/interactive changes: drive the full app (`pnpm exec tauri dev`) — unit tests alone have missed real regressions.
- **Golden rule** (OVERVIEW §21.1): Stockfish + deterministic rules decide eval, best move, classification, accuracy. The frontend only renders. Never let mock JS or an LLM decide game truth.
- **Design source**: for new "real data wiring", locate and follow the relevant `SecondBoard_PROJECT_OVERVIEW.md` §-numbered spec rather than inventing formulas.
- **Streaming long analyses** (OVERVIEW §25.4): use Tauri events, not blocking invokes, to keep the UI responsive during multi-position analysis.

<!-- END AUTO-MANAGED -->

<!-- MANUAL -->
## Custom Notes

Add project-specific notes here. This section is never auto-modified.

<!-- END MANUAL -->
