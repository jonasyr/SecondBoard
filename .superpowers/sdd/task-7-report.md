# Task 7 Report: thread `wdlPerPly` end-to-end (appState -> review.ts -> ReviewTab/ReviewPanel)

## Summary

This was the final wiring task for the Stockfish WDL iteration. It threads the
`RealAnalysis.wdlPerPly` produced by `loadRealAnalysis` (Task 6) through
`appState`, into `getAccuracySummary`, and down into `ReviewTab.svelte` /
`ReviewPanel.svelte`, following the exact same pattern already used for
`classCodes` in a prior merged iteration.

## Files changed

- `src/lib/stores/app-state.svelte.ts`
  - Added `import type { Wdl } from '$lib/game/accuracy';`
  - Added `wdlPerPly: (Wdl | null)[]` to the `AppState` interface (after `classCodes`)
  - Added `wdlPerPly: []` to `defaultState` (after `classCodes: []`)
  - `startReview`: resets `appState.wdlPerPly = []` alongside `classCodes` on every fresh parse
  - `refreshRealAnalysis`: destructures `wdlPerPly` from `loadRealAnalysis`'s result, assigns `appState.wdlPerPly = wdlPerPly`, and passes it into `classifyGame(evalPerPly, wdlPerPly)`
- `src/lib/stores/app-state.test.ts`
  - Added `'populates wdlPerPly from real analysis once it is ready, and resets it to [] on a fresh parse'` test inside `describe('real analysis loading', ...)`, right after the existing classCodes test — exact text from the brief
- `src/lib/game/review.ts`
  - Added `import type { Wdl } from './accuracy';`
  - `getAccuracySummary` gained a new optional 3rd parameter `wdlPerPly?: (Wdl | null)[]`, passed through to `computeGameAccuracy(evalPerPly, wdlPerPly)`
- `src/lib/game/review.test.ts`
  - Added the `'accepts an optional wdlPerPly...'` test at the end of `describe('getAccuracySummary', ...)` — exact text from the brief
- `src/lib/components/ReviewTab.svelte`
  - Added `import type { Wdl } from '$lib/game/accuracy';`
  - `Props` interface gained a new required `wdlPerPly: (Wdl | null)[]` field
  - `$props()` destructure now includes `wdlPerPly`
  - `accuracy` derivation now passes `appState.analysisStatus === 'ready' ? wdlPerPly : []` as `getAccuracySummary`'s 3rd argument, gated the same way as `evalPerPly`
  - Updated the comment above the derivation to describe both evalPerPly and wdlPerPly gating
- `src/lib/components/ReviewTab.test.ts`
  - Added `wdlPerPly: []` to all 5 existing `render(ReviewTab, { props: {...} })` calls
  - Added the new `'gates wdlPerPly on analysisStatus === ready...'` test at the end of `describe('ReviewTab', ...)`
- `src/lib/components/ReviewPanel.svelte`
  - `<ReviewTab ... />` call now passes `wdlPerPly={appState.wdlPerPly}`

All changes match the brief's code blocks verbatim.

## Test commands run

1. Failing-tests check (Step 2), before implementation:
   ```
   pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts
   ```
   Result: `PASS (44) FAIL (2)`
   - `getAccuracySummary accepts an optional wdlPerPly...` failed: `expected '32.4' not to be '32.4'` (computeGameAccuracy wasn't yet receiving wdlPerPly, so both calls produced identical output)
   - `real analysis loading populates wdlPerPly...` failed: `expected undefined to deeply equal []` (`appState.wdlPerPly` didn't exist yet)
   - Note: the new ReviewTab gating test already passed at this point (both gated/ungated states rendered "—" either way, since `ReviewTab`'s `Props` didn't yet declare `wdlPerPly` so passing it was a no-op) — this matches the brief's caveat that the gating test "can't [meaningfully] pass" until the prop is wired, though it happened to assert a state that was already true.

2. Passing-tests check (Step 6), after implementation:
   ```
   pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts
   ```
   Result: `PASS (46) FAIL (0)`

3. Full suite:
   ```
   rtk proxy pnpm exec vitest run
   ```
   Result: `Test Files 48 passed (48)`, `Tests 258 passed (258)`

4. Typecheck:
   ```
   pnpm check
   ```
   Result: `COMPLETED 472 FILES 0 ERRORS 14 WARNINGS 6 FILES_WITH_PROBLEMS` — all warnings are pre-existing a11y/svelte-state warnings in unrelated files (Board.svelte, MoveList.svelte, OnboardingScreen.svelte, ExploreTab.svelte, NavControls.svelte, TitleBar.svelte), none introduced by this change.

## Commit

```
1aafabe feat: thread real wdlPerPly through appState into accuracy and classification
```
7 files changed, 75 insertions(+), 15 deletions(-)

## Self-review

- Implementation matches the brief's code blocks exactly (imports, field placement, gating pattern for wdlPerPly mirrors the existing evalPerPly gating in ReviewTab.svelte).
- Existing tests in `app-state.test.ts` that mock `loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} })` (without a `wdlPerPly` key) are untouched per the brief's instructions — after this change, those resolve with `appState.wdlPerPly = undefined` in that code path. This is pre-existing test fixture shape the brief didn't ask me to update, and it doesn't break any assertion (no test in that describe block asserts on `wdlPerPly` except the new one, which supplies it explicitly). Flagging it since it means `AppState.wdlPerPly`'s static type (`(Wdl | null)[]`) doesn't strictly hold at runtime for those particular mocked test paths — but this is scoped to test mocks, not production code, and `loadRealAnalysis`'s real return type (from Task 6) always includes `wdlPerPly`.
- No behavior change for existing callers: `getAccuracySummary`'s new 3rd parameter is optional and `computeGameAccuracy`/`classifyGame` already handle `undefined` (from Tasks 4/5), so all pre-existing call sites without `wdlPerPly` are unaffected.
- Ran the full test suite and typecheck as final sanity checks; both clean.
