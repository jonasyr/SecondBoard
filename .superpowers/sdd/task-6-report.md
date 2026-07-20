# Task 6 Report — ReviewPanel/ReviewTab/BottomBar real classification

## What was implemented

Followed the brief exactly (`.superpowers/sdd/task-6-brief.md`), steps 1-9.

1. **`src/lib/components/ReviewTab.test.ts`** — added `classCodes: []` to all 4 `render(ReviewTab, { props: {...} })` calls (one per `it` block).
2. **`src/lib/components/BottomBar.test.ts`** — added `classCodes: []` to all 3 `render(BottomBar, { props: {...} })` calls.
3. **`src/lib/components/ReviewTab.svelte`** — removed the `import { CLASS_CODES } from '$lib/game/mock-data'` import, added `import type { ClassCode } from '$lib/types'`, added `classCodes: ClassCode[]` to `Props` and destructured it from `$props()`. Updated `<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />` to `<EvalGraph {evalPerPly} {classCodes} {ply} height={66} />`. Kept the existing `appState` import (still used by the `accuracy` derivation) and the existing `accuracy` derivation logic unchanged.
4. **`src/lib/components/BottomBar.svelte`** — same pattern: removed the mock `CLASS_CODES` import, added `import type { ClassCode } from '$lib/types'`, added `classCodes: ClassCode[]` to `Props`, destructured it, and updated the `<EvalGraph ... />` call to use `{classCodes}`.
5. **`src/lib/components/ReviewPanel.svelte`** — added `classCodes={appState.classCodes}` to both the `<ReviewTab ... />` and `<BottomBar ... />` invocations, and fixed the previously misindented `<ReviewTab ... />` call's attributes to match the brief's target snippet (which showed properly tab-indented attributes; the pre-existing file had them de-indented).

Confirmed no residual references to the mock `CLASS_CODES` remain in either `.svelte` file (`grep -rn "CLASS_CODES" ReviewTab.svelte BottomBar.svelte` → no matches).

Confirmed `appState.classCodes` exists and is populated by prior tasks (`src/lib/stores/app-state.svelte.ts:93` resets it to `[]`, `:115` sets it via `classifyGame(evalPerPly)`).

## Test commands run and output

**Step 4 (pre-refactor, preparatory check)** — with only the test files updated (mock import still present, `Props` interfaces not yet updated):
```
pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts
```
Result: `PASS (8) FAIL (0)` — as the brief anticipated, Svelte silently accepts the extra unknown `classCodes` prop at this stage, so this step confirms "unchanged," not a hard failure. This matched the brief's explicit expectation for Step 4.

**Step 8 (post-refactor)** — after implementing steps 5-7:
```
pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts
```
Result: `PASS (8) FAIL (0)` — all green.

**Final full-suite sanity check** (per instructions, run via `rtk proxy` since the rtk wrapper had previously truncated plain vitest output on this machine):
```
rtk proxy pnpm exec vitest run
```
Result:
```
 Test Files  48 passed (48)
      Tests  242 passed (242)
   Duration  8.93s
```
(Some pre-existing Svelte a11y lint warnings from `vite-plugin-svelte` appeared in the output — unrelated to this change, present in `MoveList.svelte`, `Board.svelte`, `OnboardingScreen.svelte`, `ExploreTab.svelte`, `NavControls.svelte` — no new warnings introduced by this task's files.)

## Commit hash

`caaed74` — "feat: eval graph (ReviewTab/BottomBar) renders real per-move classification"

Files changed: `src/lib/components/ReviewPanel.svelte`, `src/lib/components/ReviewTab.svelte`, `src/lib/components/ReviewTab.test.ts`, `src/lib/components/BottomBar.svelte`, `src/lib/components/BottomBar.test.ts` (5 files changed, 22 insertions(+), 15 deletions(-)).

## Self-review

- Diff matches the brief's exact before/after snippets for all four production/test files; no extra refactoring introduced beyond fixing pre-existing indentation in `ReviewPanel.svelte`'s `<ReviewTab .../>` call (which the brief's own target snippet showed correctly indented).
- `appState.classCodes` is real (from Task 2), not a stub — verified by grep against `app-state.svelte.ts`.
- No other call sites in the codebase still import `CLASS_CODES` from `$lib/game/mock-data` for use in `ReviewTab.svelte`/`BottomBar.svelte` — grep confirmed clean.
- Full 242-test suite passes with no regressions.
- No ambiguity encountered; brief was unambiguous and matched the actual file contents on disk exactly before editing.

## Concerns

None.
