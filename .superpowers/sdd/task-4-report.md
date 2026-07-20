# Task 4 Report: `accuracy.ts` — `Wdl` type, `winPercentFromWdl`, `winPercentForPly`

## What was implemented

Followed the brief exactly (`.superpowers/sdd/task-4-brief.md`).

### `src/lib/game/accuracy.ts`

1. Added `export type Wdl = readonly [w: number, d: number, l: number]` — White-POV per-mille win/draw/loss, documented as using the same convention as `evalPerPly`.
2. Added `export function winPercentFromWdl(wdl: Wdl): number` — `(wdl[0] + 0.5 * wdl[1]) / 10`, i.e. lichess/chess.com-style expected score scaled to 0-100.
3. Added `export function winPercentForPly(ply: number, evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): number` — returns `winPercentFromWdl(wdl)` when `wdlPerPly?.[ply]` is present and truthy, otherwise falls back to `winPercentFromEval(evalPerPly[ply])`.
4. Changed `computeGameAccuracy`'s signature to `computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy` and changed its `winPercents` derivation from `evalPerPly.map(winPercentFromEval)` to `evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly))`. The rest of the function body (windowing, weights, per-move accuracy loop, weighted/harmonic mean combine) is untouched.

All new code was inserted verbatim from the brief; no deviations.

### `src/lib/game/accuracy.test.ts`

1. Updated the import line to add `winPercentFromWdl, winPercentForPly`.
2. Inserted four new `describe` blocks (`winPercentFromWdl`, `winPercentForPly`, `computeGameAccuracy with WDL`) verbatim from the brief, placed right after the existing `winPercentFromEval` describe block and before the existing `computeGameAccuracy` describe block.
3. No existing test in the file was modified.

## Test commands run and output

### Step 2 — confirm new tests fail before implementation

```
pnpm exec vitest run src/lib/game/accuracy.test.ts
```
Result: `PASS (16) FAIL (7)` — the 7 new tests failed with `TypeError: ... is not a function` for `winPercentFromWdl`/`winPercentForPly` (as expected; `computeGameAccuracy`'s WDL-vs-no-WDL test was among the failures too, since the 2nd arg was being ignored). The 16 pre-existing tests already passed at this point (file only had the test additions, not yet the implementation).

### Step 4 — confirm all tests pass after implementation

```
pnpm exec vitest run src/lib/game/accuracy.test.ts
```
Result: `PASS (23) FAIL (0)` — all 23 tests in the file pass, including every pre-existing test.

### Full-suite regression check

```
rtk proxy pnpm exec vitest run
```
Result: `Test Files  48 passed (48)` / `Tests  251 passed (251)`. No failures anywhere in the repo (only pre-existing, unrelated Svelte a11y lint warnings printed by vite-plugin-svelte, not test failures).

## Self-review

- **No-regression requirement (most important check):** The brief's own new test `computeGameAccuracy with WDL > produces the exact same result as before when wdlPerPly is omitted (no regression)` asserts `white ≈ 37.3255159268525` (9 decimal places) and `black === 100` for `computeGameAccuracy([0, -3, -3.2, -8, -8.5])` — this is the exact same input and exact same expected values as the pre-existing `computeGameAccuracy > penalizes a mover who worsens their own win% while rewarding one who doesn't` test elsewhere in the file. Both tests pass, confirming omitting `wdlPerPly` produces byte-for-byte identical output to before the change.
- Every pre-existing test in `accuracy.test.ts` (the `winPercentFromEval`, `computeGameAccuracy`, `resolveWinner`, `estimatePerformanceRating` describe blocks) was left completely unmodified — no line inside those blocks was touched — and all of them still pass.
- The WDL-preference test (`uses the WDL-derived win% for a ply that has one, changing the result vs. eval-only`) confirms `winPercentForPly` actually changes `computeGameAccuracy`'s output when a WDL entry is present and that it's applied per-ply (ply 0 has WDL, ply 1 doesn't — mixed usage works).
- Ran the entire repo test suite (48 files / 251 tests), not just this file, to make sure nothing downstream (there are no other consumers yet — Tasks 5-7 come later) broke. All green.
- Implementation matches the brief's code block verbatim (type, functions, docstrings, and the `computeGameAccuracy` signature/body diff) — no deviations were needed.
- Note: this report file previously contained a stale report from an unrelated task (`MoveList.svelte`/`AnalysisTab.svelte` classification work) — apparently leftover from a different branch/iteration. It has been overwritten with this task's actual report.

## Commit

```
a87411d feat: prefer WDL-derived win%% over the eval sigmoid when the engine reports it
```
2 files changed (`src/lib/game/accuracy.ts`, `src/lib/game/accuracy.test.ts`), 92 insertions, 3 deletions — matches the exact `git add` file list and commit message given in the brief's Step 5.
