# SecondBoard — core map

Local-first chess review companion: SvelteKit 5 (runes) frontend + Tauri v2 (Rust) backend, running as a desktop app on Windows. "Local · Offline" positioning — no cloud backend, Stockfish runs locally via Tauri commands.

## Source map
- `src/routes/` — SvelteKit shell (`+layout.svelte`, `+page.svelte`).
- `src/lib/components/` — one `.svelte` per UI piece, each with a co-located `*.test.ts` (Vitest + @testing-library/svelte). See `src/lib/components/README.md` for the component catalog.
- `src/lib/stores/app-state.svelte.ts` — single reactive `$state` singleton (`appState`) holding screen/tab/ply/game/analysis status. All mutations go through named functions (`startReview`, `goToPly`, `stepPly`, `newGame`, `handleReviewKeydown`) — never mutate `appState` fields directly from components except trivial UI-only ones (`appState.tab = ...`).
- `src/lib/game/` — game-domain logic: `review.ts` (per-ply derivation, `GameData`/`PlayerRowData` types), `engine-analysis.ts` (orchestrates real Stockfish analysis across a game's positions), `notation.ts` (FEN/SAN helpers), `mock-data.ts` (remaining mock fixtures — see `mem:mocks_vs_real`), `sample-pgn.ts` (built-in sample game).
- `src/lib/api/` — thin Tauri `invoke()` wrappers: `pgn.ts` (`parse_pgn`), `engine.ts` (`analyze_fen`), `window.ts` (minimize/maximize/close).
- `src/lib/board/` — board rendering + `types.ts` (`Position`, `Move`, `PieceColor`, `PieceType`) + `geometry.ts` (capturedInfo, evalBarPct, pure math) + `pieces/` (SVG sprite map).
- `src/lib/charts/eval-graph.ts` — pure SVG path math for the eval graph, reusable/stack-agnostic.
- `src/lib/tokens.ts` — the single source of design tokens (colors, classification glyph/color map, radii). Components read `TOKENS.*`, never hardcode design values.
- `src-tauri/src/` — `pgn.rs` (PGN→positions via `pgn_reader`/`shakmaty`, mainline only, no RAV), `engine.rs` (Stockfish invocation for `analyze_fen`), `lib.rs`/`main.rs` (Tauri command registration).

## Project-wide invariants
- **Mock vs real data**: see `mem:mocks_vs_real` — critical before touching player names, ratings, accuracy, classification, or eval data.
- Design/UX source of truth lives outside `src/`: `design_handoff_secondboard/` — see `mem:design_handoff`.
- Development happens via an "SDD" (spec-driven development) loop: each unit of work gets a `.superpowers/sdd/task-N-brief.md` (spec) and `task-N-report.md` (what shipped), plus periodic `docs: update sdd ledger` commits. Diff snapshots also land in `.superpowers/sdd/review-<sha>..<sha>.diff` after review passes.
- Windows dev machine — see `mem:suggested_commands` for shell differences.
