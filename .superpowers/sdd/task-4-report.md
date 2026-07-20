# Task 4 Report: `AnalysisTab.svelte` + `MoveList.svelte` — real classification

## What was implemented

1. **`src/lib/components/MoveList.test.ts`** — replaced entirely per the brief: added `import type { ClassCode } from '$lib/types'`, replaced `isSample: boolean` props with `classCodes: ClassCode[]` across all 7 test cases, and replaced the two `isSample`-gated badge tests with:
   - "does not show a classification badge for a ply with no classCodes entry (analysis not ready)" — asserts 0 badges when `classCodes: []`.
   - "shows a classification badge for every ply that has a real classCodes entry" — asserts 2 badges when `classCodes: ['excellent', 'blunder']`.
   - "still highlights the selected cell when classCodes is empty" (renamed from the old isSample-false version).

2. **`src/lib/components/MoveList.svelte`** — rewrote the script block and template exactly as specified in the brief:
   - Dropped `import { CLASS_CODES } from '$lib/game/mock-data'` and the `isSample: boolean` prop.
   - Added `classCodes: ClassCode[]` as a required prop.
   - `cellStyle()` no longer takes an `isSample` parameter — it derives color purely from the `code: ClassCode | null` argument.
   - Template now reads `classCodes[row.wPly - 1] ?? null` / `classCodes[row.bPly - 1] ?? null` directly (no more `isSample ? CLASS_CODES[...] : null` mock lookup), and the `{#if classCodes[...]}` guards gate the `<ClassBadge>` on a real entry existing at that ply index, not on a global `isSample` flag.
   - The `<style>` block is untouched.

3. **`src/lib/components/AnalysisTab.svelte`**:
   - `getReviewPly(...)` call now passes `appState.classCodes` as the 5th argument.
   - `<MoveList>` now receives `classCodes={appState.classCodes}` instead of `isSample={appState.game!.isSample}`.

## Test commands run and output

1. Wrote the new `MoveList.test.ts` (Step 1), then ran to confirm failure (Step 2):
   ```
   pnpm exec vitest run src/lib/components/MoveList.test.ts
   ```
   Result: **PASS (6) FAIL (1)** — the new "shows a classification badge for every ply that has a real classCodes entry" test failed with `expected [] to have a length of 2 but got +0`, confirming the old `isSample`-gated component didn't yet honor per-ply `classCodes` entries.

2. Implemented the `MoveList.svelte` rewrite (Step 3), reran (Step 4):
   ```
   pnpm exec vitest run src/lib/components/MoveList.test.ts
   ```
   Result: **PASS (7) FAIL (0)** — all green.

3. Before touching `AnalysisTab.svelte`, confirmed the caller test breaks against the new `MoveList` prop shape (Step 5, first run):
   ```
   pnpm exec vitest run src/lib/components/AnalysisTab.test.ts
   ```
   Result: **PASS (0) FAIL (4)** — all 4 tests threw `TypeError: Cannot read properties of undefined (reading '0')` inside `MoveList.svelte` (from `classCodes[row.wPly - 1]` when `classCodes` was `undefined`, since `AnalysisTab.svelte` was still passing `isSample` instead of `classCodes`).

4. Implemented the `AnalysisTab.svelte` changes (Step 5), reran both suites together (Step 6):
   ```
   pnpm exec vitest run src/lib/components/AnalysisTab.test.ts src/lib/components/MoveList.test.ts
   ```
   Result: **PASS (11) FAIL (0)** — all green.

5. Ran the full test suite as a regression check (not required by the brief, done for due diligence):
   ```
   pnpm exec vitest run
   ```
   Result: 4 suites, 20 tests, 17 passed / 3 failed. The 3 failures are all in `src/lib/game/review.test.ts` (`ply 1 is classified from the real evalPerPly...`, `applies real classification to a non-sample game too...`, `shows no classification/coach-classification text when classCodes has no entry yet...`) — pre-existing failures from Task 3's `842fc31` commit (already on the branch before this task started; I did not touch `review.ts` or `review.test.ts`). Confirmed via `git log --oneline -- src/lib/game/review.ts src/lib/game/review.test.ts`, which shows only Task 3's commit touching those files, and `git status` shows no local modifications to them. Out of scope for Task 4.

## Commit

```
199a6fc feat: MoveList and AnalysisTab render real per-move classification
```
3 files changed (`src/lib/components/AnalysisTab.svelte`, `src/lib/components/MoveList.svelte`, `src/lib/components/MoveList.test.ts`), 32 insertions, 21 deletions — matches the exact `git add` file list and commit message given in the brief's Step 7.

## Self-review

- **TDD followed**: test file replaced first, ran to observe the expected failure (badge-visibility test failing because the component still gated on `isSample` instead of per-ply `classCodes`), then implemented, then reran to green. Same red/green cycle repeated for the `AnalysisTab` caller-side change (confirmed the `TypeError` before wiring `classCodes` through).
- All code changes were copied verbatim from the brief's exact before/after snippets — no deviation in logic, naming, or structure.
- Nothing questionable found. The only judgment call was running the full test suite for a regression check beyond the brief's explicit steps; I confirmed the 3 unrelated failures pre-date this task and are not caused by or fixed by this work, so I left them untouched (correctly out of scope per the task boundaries — Task 3 owns `review.ts`).
- Did not touch `.superpowers/sdd/*` planning docs or the unrelated untracked `docs/` files that were already present in git status at the start of the session.
- Note: this report file previously (before this task ran) contained leftover content from a different task's report (`getAccuracySummary` in `review.ts`) — likely a stale/misplaced write from an earlier agent run. It has been overwritten with this task's actual report.
