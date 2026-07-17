# Prospective best-move arrow — design

## Problem

The board currently only draws an engine-suggestion arrow *retrospectively*:
after a move classified as inaccuracy/mistake/miss/blunder (sample game
only, gated on `classCode`), it shows what should have been played instead
of the move that was actually made. Real (non-sample) games never get an
arrow at all, since they have no `classCode`.

The user wants a *prospective* arrow instead: at whatever position is
currently on screen, show the engine's top suggestion for the move about to
be played, for both sample and real games, updating every time you step
forward or back.

## Design

`bestMoves` (computed in `engine-analysis.ts`'s `loadRealAnalysis`) already
stores, at key `ply`, the engine's suggested move computed from
`positions[ply - 1]` — i.e. "what should have been played to reach `ply`".
The prospective arrow needs the mirror image: the suggestion computed
*from* the position currently on screen (`positions[ply]`), for whichever
move comes next. That's simply `bestMoves[ply + 1]`.

### Changes

1. **`src/lib/game/review.ts`** — `ReviewPly` gains a new field:
   ```ts
   nextBest: (Move & { san: string }) | null;
   ```
   computed in `getReviewPly()` as `bestMoves[ply + 1] ?? null` —
   unconditional, no `classCode`/`isSample` gating. The existing `best`
   field (retrospective, classification-gated) is unchanged and keeps
   feeding `CoachCard`'s "best was" text in `AnalysisTab.svelte`.

2. **`src/lib/components/Board.svelte`** — per the approved design choice,
   the board shows only one arrow at a time. Replace the `best`/`classCode`
   -gated arrow with the new prospective one:
   - Prop renamed from `best` to `nextBest` (same shape), no longer paired
     with `classCode` for the arrow decision.
   - `showArrow` becomes `!!nextBest` (no `classCode`/`NOT_BEST_CODES`
     check). Remove the now-unused `NOT_BEST_CODES` import if nothing else
     in the file needs it (`classCode` itself stays — still drives
     `highlightColor`/badge/brilliant-square).
   - `arrow` derivation switches to `arrowGeom(nextBest.from, nextBest.to, 11, flipped)`.

3. **`src/lib/components/GameReviewScreen.svelte`** — passes
   `best={data.nextBest}` → `nextBest={data.nextBest}` (prop rename)
   instead of `data.best`.

### Behavior at the edges

- **Ply 0 (starting position):** arrow shows if `bestMoves[1]` exists —
  e.g. e2→e4 if that's Stockfish's top choice for White's first move.
- **Final ply (game over):** no arrow — `bestMoves` never gets an entry for
  `positions.length` (the `loadRealAnalysis` loop explicitly excludes the
  terminal position, since there's no "next move" to suggest from a
  finished game).
- **Before analysis completes:** no arrow — `bestMoves` is `{}` until
  `refreshRealAnalysis()` resolves, so the arrow simply appears once ready;
  no separate loading state needed for this feature (the existing
  eval-bar/eval-graph "Analyzing…" indicators already cover that).
- Applies identically to sample and real (pasted) games — no `isSample`
  distinction, since `bestMoves` is always real Stockfish output regardless
  of which game is loaded.

### Out of scope

- `CoachCard`'s "Best was: X" text and its own `best` prop/data are
  unaffected — that stays retrospective and sample-game-only, as today.
- No new loading/placeholder state for the arrow itself.
- No changes to arrow color/styling/geometry — reuses `arrowGeom` and the
  existing SVG overlay verbatim.

## Testing

- `review.test.ts`: `getReviewPly` returns the correct `nextBest` from
  `bestMoves[ply + 1]`, `null` at the final ply, `null` when `bestMoves` has
  no entry for `ply + 1`, and that it does NOT depend on `classCode`/`isSample`.
- `Board.test.ts`: arrow renders when `nextBest` is provided (regardless of
  `classCode`), no arrow when `nextBest` is `null`, arrow geometry uses
  `nextBest.from`/`nextBest.to`.
- `GameReviewScreen.test.ts`: passes `data.nextBest` to `Board`.
