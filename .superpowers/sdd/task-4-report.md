# Task 4 Report: `review.ts` — `getAccuracySummary` (real data + mock-name fallback)

## What I implemented

Added to `src/lib/game/review.ts`:
- Import of `computeGameAccuracy`/`resolveWinner` from `./accuracy`, appended to the existing `./mock-data` import line.
- `AccuracySide` and `AccuracySummary` interfaces.
- `formatResultLabel(result: string | null): string` — maps `'1-0'` → `'1–0'`, `'0-1'` → `'0–1'`, `'1/2-1/2'` → `'½–½'`, anything else (including `null`) → `'—'`.
- `getAccuracySummary(game: GameData, evalPerPly: number[]): AccuracySummary` — resolves white/black display name via `game.whiteName/blackName ?? PLAYERS.white/black.name` (same fallback pattern as the existing `getPlayerRows`), computes per-side accuracy via `computeGameAccuracy(evalPerPly)` (formatted with `.toFixed(1)`, or `null` when the underlying value is `null`), resolves the winner via `resolveWinner(game.result)`, and formats `resultLabel` via `formatResultLabel`.

Code and placement match the brief exactly (appended at the end of the file, after `getPlayerRows`).

## What I tested and results

Added the 4-test `describe('getAccuracySummary', ...)` block from the brief to `src/lib/game/review.test.ts`, verbatim, plus extending the top import line to include `getAccuracySummary`.

Ran: `pnpm exec vitest run src/lib/game/review.test.ts`

## TDD Evidence

**RED** (before implementing `getAccuracySummary` in `review.ts`):
```
PASS (13) FAIL (4)
1. getAccuracySummary falls back to the mock PLAYERS names when the PGN has no name tags, and resolves the real winner
   TypeError: (0 , __vite_ssr_import_1__.getAccuracySummary) is not a function
2. getAccuracySummary uses real PGN names when present
   TypeError: ... is not a function
3. getAccuracySummary reports accuracy as null (not a fabricated number) when there is not enough eval data yet
   TypeError: ... is not a function
4. getAccuracySummary formats a draw result and marks neither side as the winner
   TypeError: ... is not a function
```

**GREEN** (after implementing):
```
PASS (17) FAIL (0)
```

All 17 tests in the file pass (13 pre-existing `getReviewPly`/`getPlayerRows` tests + 4 new `getAccuracySummary` tests), no failures, no stray console output.

## Files changed

- `src/lib/game/review.ts` — added `./accuracy` import, `AccuracySide`/`AccuracySummary` interfaces, `formatResultLabel`, `getAccuracySummary`.
- `src/lib/game/review.test.ts` — added `getAccuracySummary` to the import from `./review`, added the `describe('getAccuracySummary', ...)` block with 4 tests.

Commit: `b752be4` — "feat: derive real winner/accuracy summary in getAccuracySummary"

## Self-review findings

- `getAccuracySummary` uses the exact same real-name-over-mock-fallback pattern as `getPlayerRows`: `game.whiteName ?? PLAYERS.white.name`, `game.blackName ?? PLAYERS.black.name`. Confirmed by direct comparison against `getPlayerRows` in the same file.
- `accuracy` is typed and produced as `string | null` — `white === null ? null : white.toFixed(1)` — never a fabricated number when `computeGameAccuracy` returns `null` for a side.
- `formatResultLabel` covers all four brief cases (`'1-0'`, `'0-1'`, `'1/2-1/2'`, fallback `'—'` for `null`/anything else) — verified against test 1 (`'0-1'` → `'0–1'`), test 3 (`null` → `'—'`), test 4 (`'1/2-1/2'` → `'½–½'`).
- Test output pristine: `PASS (17) FAIL (0)`.
- Staged/committed only the two intended files (`review.ts`, `review.test.ts`); confirmed via `git status --short` before committing that no unrelated files were swept in.

## Concerns

None. Implementation matches the brief exactly, no deviations, no transcription issues found. (Note: this file previously contained a stray report from an unrelated task run — it has been overwritten with this task's own report.)
