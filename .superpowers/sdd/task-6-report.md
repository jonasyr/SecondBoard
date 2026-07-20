# Task 6 Report: `engine-analysis.ts` — produce `wdlPerPly` (White-POV) from real analysis

## Summary

Implemented `wdlPerPly` on `RealAnalysis` in `src/lib/game/engine-analysis.ts`, exactly per the brief:

- Imported `PieceColor` from `$lib/board/types` and `Wdl` from `./accuracy`.
- Added `wdlPerPly: (Wdl | null)[]` to the `RealAnalysis` interface.
- Added `toWhitePovWdl(wdl, sideToMove)`: a pure helper mirroring `toWhitePovEval`'s flip pattern, but swapping win/loss (index 0 and 2) instead of negating, since draw (index 1) is symmetric.
- In `loadRealAnalysis`, computed `wdlPerPly` per ply as `r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null`, and included it in the returned object alongside `evalPerPly` and `bestMoves`.

Added two new tests to the end of the `describe('loadRealAnalysis', ...)` block in `src/lib/game/engine-analysis.test.ts`, verbatim from the brief:

1. `'produces one wdlPerPly entry per position, flipped to White POV'` — mocks `analyzeFen` to always return `wdl: [600, 300, 100]`, asserts ply 0 (White to move) is unflipped `[600, 300, 100]` and ply 1 (Black to move) is flipped to `[100, 300, 600]`.
2. `'reports null wdlPerPly entries for positions where the engine did not report wdl'` — mocks `wdl: null`, asserts every `wdlPerPly` entry is `null`.

No changes were made to any pre-existing test bodies. As predicted by the brief, every pre-existing test's mocked `analyzeFen` resolved value omits the `wdl` field entirely, so `r.wdl` is `undefined` (falsy) there, and the ternary falls through to `null` for every ply — those tests never assert on `wdlPerPly` and continue passing unmodified.

## Test commands run and output

### Step 2 — confirm tests fail before implementation

```
pnpm exec vitest run src/lib/game/engine-analysis.test.ts
```
Result: `PASS (6) FAIL (2)` — the two new tests failed as expected:
- `produces one wdlPerPly entry per position, flipped to White POV`: `AssertionError: Target cannot be null or undefined.` (`wdlPerPly` was `undefined`)
- `reports null wdlPerPly entries for positions where the engine did not report wdl`: `TypeError: Cannot read properties of undefined (reading 'every')`

All 6 pre-existing tests passed at this point (unmodified, before the implementation changes), confirming the test file changes alone don't break anything and isolating the failures to the two new cases.

### Step 4 — confirm tests pass after implementation

```
pnpm exec vitest run src/lib/game/engine-analysis.test.ts
```
Result: `PASS (8) FAIL (0)` — all 8 tests (6 pre-existing + 2 new) passed.

### Additional verification

```
rtk tsc
```
Result: `TypeScript: No errors found`

```
rtk proxy pnpm exec vitest run
```
(Full project suite, run through `rtk proxy` because RTK's vitest output parser failed to parse this run's raw output — using proxy mode to get the real vitest summary instead of a parse-failure passthrough.)

Result: `Test Files 48 passed (48)` / `Tests 255 passed (255)`. No failures anywhere in the repo. (Some pre-existing Svelte a11y/reactivity lint warnings from `vite-plugin-svelte` appear in the log — unrelated to this change, not test failures, and pre-existing on this branch.)

## Commit

```
ce0a8f0 feat: loadRealAnalysis produces White-POV wdlPerPly alongside evalPerPly
```

Files changed: `src/lib/game/engine-analysis.ts` (+17/-2), `src/lib/game/engine-analysis.test.ts` (+24).

## Self-review

- Followed the brief's exact code verbatim for both the test additions and the implementation (imports, interface, helper, and `loadRealAnalysis` body match the brief character-for-character where specified).
- Verified the "zero changes needed to pre-existing tests" claim empirically rather than assuming it: ran the full pre-existing 6-test file before touching `engine-analysis.ts` and confirmed only the 2 new tests failed; after implementing, all 8 passed with no edits to the original 6 test bodies.
- `toWhitePovWdl`'s type signature takes `PieceColor` (not the inline `'w' | 'b'` used by the neighboring `toWhitePovEval`) per the brief — both are structurally identical types so this introduces no behavioral difference, just matches the brief's stated import list (`PieceColor` from `$lib/board/types`).
- Confirmed `AnalyzeFenResult.wdl: [number, number, number] | null` already exists in `src/lib/api/engine.ts` (from Task 3) and `Wdl` already exists in `src/lib/game/accuracy.ts` (from Task 4) before relying on them — both were already committed on this branch, so no cross-task drift.
- Ran `tsc` and the full 255-test project suite (not just the one file) to confirm no regressions elsewhere (e.g. any other consumer destructuring `RealAnalysis` that might be affected by the new required field) — none found; `wdlPerPly` is additive only, and Task 7 (wiring it into `app-state.svelte.ts`) is explicitly out of scope for this task.
- Note: this file previously contained a stale report from an unrelated earlier iteration's "Task 6" (ReviewPanel/ReviewTab/BottomBar classification work) — that content has been replaced with this task's actual report since it did not describe this task's work.
- No concerns. Task is complete and self-contained; ready for Task 7 to consume `RealAnalysis.wdlPerPly`.
