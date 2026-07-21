# Task 2 Report: Per-phase accuracy and badge-ready rows

## Summary

Implemented exactly per the brief (`.superpowers/sdd/task-2-brief.md`), following TDD (failing test -> implementation -> passing test -> commit) for each of the two changes.

## Step 1-5: `computeGameAccuracy` `startPly` parameter

- Added two tests to `src/lib/game/accuracy.test.ts` inside the existing `describe('computeGameAccuracy', ...)` block (verbatim from the brief):
  - `attributes movers correctly when startPly shifts an odd-indexed slice (Black moves first in the slice)`
  - `defaults startPly to 0, reproducing existing behavior byte-for-byte when omitted`
- Confirmed both tests failed before the fix (`withStartPly.white` was `2.201565856218382` instead of `null`, since the 3rd argument was silently ignored).
- Modified `src/lib/game/accuracy.ts`:
  - `computeGameAccuracy` signature gained a 3rd optional parameter `startPly = 0`.
  - The per-move loop's `sideToMoveForPly(ply)` call became `sideToMoveForPly(startPly + ply)`.
  - Doc comment updated with the sentence from the brief explaining the new parameter's purpose.
- Verified: `pnpm exec vitest run src/lib/game/accuracy.test.ts` -> 25/25 passed (23 pre-existing + 2 new).
- Committed as `a3b1a8b`.

## Step 6-10: `getPhaseRows` in `phase.ts`

- Added a new `describe('getPhaseRows', ...)` block to `src/lib/game/phase.test.ts` (verbatim from the brief, 4 tests) and updated the import line to `import { dividePhases, getPhaseRows } from './phase';`.
- Confirmed all 4 new tests failed before implementation (`getPhaseRows is not a function`).
- Appended to `src/lib/game/phase.ts` (verbatim from the brief):
  - New import: `import { computeGameAccuracy, type Wdl } from './accuracy';`
  - `export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy'` plus `PHASE_BEST_THRESHOLD` (90) / `PHASE_GOOD_THRESHOLD` (75) constants and `phaseBadgeCode()` helper.
  - `export interface PhaseRow { name; white; black }`.
  - `export function getPhaseRows(positions, evalPerPly, wdlPerPly?)`: derives phase ply ranges from `dividePhases`, slices `evalPerPly`/`wdlPerPly` per phase, and calls `computeGameAccuracy` with the phase's `start` as the new `startPly` argument so mover-color attribution stays correct across slice boundaries. Always returns exactly 3 rows in Opening/Middlegame/Endgame order; `white`/`black` are `null` when `computeGameAccuracy` returns `null` for that side (insufficient data), never fabricated.
- Verified: `pnpm exec vitest run src/lib/game/phase.test.ts` -> 12/12 passed (8 pre-existing Task-1 tests + 4 new).
- Committed as `4f3d16d`.

## Final verification

- Full suite: `pnpm exec vitest run` -> 54 test files, 331 tests, all passed.
- `pnpm exec tsc --noEmit` -> clean (only pre-existing, unrelated Svelte a11y lint warnings from `vite-plugin-svelte`, no TypeScript errors).

## Files touched

- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/accuracy.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/accuracy.test.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/phase.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/phase.test.ts`

## Concerns

None. All brief code was copied verbatim; no deviations from the given fixtures or thresholds were needed. Both commits are on `feat/special-move-classes` as required, sitting on top of Task 1's `77ecd70`.

Note: this file replaces an unrelated, stale "Task 2" report from an earlier round of work on this branch (Great-move-threshold recalibration) -- the brief for this round explicitly targets this same path.
