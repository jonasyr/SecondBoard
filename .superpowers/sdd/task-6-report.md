# Task 6 Report: `ReviewTab.svelte` — wire the real summary in

## What I implemented

- Replaced `src/lib/components/ReviewTab.test.ts` entirely with the brief's version: added a `beforeEach` that seeds `appState.game` (following the exact `AnalysisTab.test.ts:20-31` pattern) and a new test asserting the real winner (`0–1`, from `game.result`) renders instead of a hardcoded value.
- Updated `src/lib/components/ReviewTab.svelte`:
  - Imported `appState` from `$lib/stores/app-state.svelte` and `getAccuracySummary` from `$lib/game/review`.
  - Added `const accuracy = $derived(getAccuracySummary(appState.game!, evalPerPly));` — using the `evalPerPly` prop already passed in for the eval graph, not `appState.evalPerPly`.
  - Changed `<AccuracyBlock />` to `<AccuracyBlock white={accuracy.white} black={accuracy.black} resultLabel={accuracy.resultLabel} />`.
  - Left the `<style>` block untouched.

## Testing

### RED (before the `.svelte` change)
Command: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Result: `PASS (0) FAIL (4)` — all four tests threw
`TypeError: Cannot read properties of undefined (reading 'name') at AccuracyBlock.svelte:17:29`, because `AccuracyBlock` (Task 5) now requires `white`/`black`/`resultLabel` props that `ReviewTab.svelte` wasn't passing yet.

### GREEN (after the `.svelte` change)
Command: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Result: `PASS (4) FAIL (0)`

Re-confirmed via the direct binary (`./node_modules/.bin/vitest.CMD run src/lib/components/ReviewTab.test.ts`) to bypass the local `rtk` proxy's output truncation:
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Full suite
Command: `./node_modules/.bin/vitest.CMD run` (ran the binary directly — the `rtk` proxy wrapper on this machine truncates/garbles vitest's stdout, so I bypassed it for a trustworthy reading; behavior is otherwise identical to `pnpm exec vitest run`)
Result:
```
 Test Files  47 passed (47)
      Tests  220 passed (220)
```
Exit code 0. Only pre-existing, unrelated `vite-plugin-svelte` a11y/state warnings appeared in the console (Board.svelte, MoveList.svelte, OnboardingScreen.svelte, ExploreTab.svelte, NavControls.svelte) — none touch files I changed.

### `pnpm check`
Result: `COMPLETED 470 FILES 0 ERRORS 15 WARNINGS 6 FILES_WITH_PROBLEMS` — 0 errors. The 15 warnings are the same pre-existing a11y/CSS-property warnings (MoveList, Board, NavControls, ExploreTab, OnboardingScreen, TitleBar) unrelated to `ReviewTab.svelte`.

## Files changed

- `src/lib/components/ReviewTab.svelte` (+5/-1)
- `src/lib/components/ReviewTab.test.ts` (+23/-1)

Diff matches the brief's Step 1 and Step 3 content exactly.

## Self-review

- `ReviewTab.svelte` uses `appState.game!` (non-null assertion), matching `AnalysisTab.svelte`'s established convention — no extra null-guard branching added.
- `getAccuracySummary` is called with the `evalPerPly` prop, not `appState.evalPerPly` read separately.
- Full suite passes (220/220, 47/47 files), not just the focused `ReviewTab.test.ts` file.
- Test output is pristine: no failures, no new warnings introduced by this change (all warnings present are pre-existing in unrelated files).

## Concerns

None. No other component/test assumed the old mock-only `AccuracyBlock` API — `AccuracyBlock.test.ts` and `AnalysisTab.svelte`/`AnalysisTab.test.ts` were already updated in prior tasks (5 and earlier) to the new props-based API, and the full-suite run confirms nothing else broke.

One environment note (not a code concern): the `rtk` CLI wrapper on this machine truncates/garbles `vitest run`'s output when piped (`[RTK:PASSTHROUGH] vitest parser: All parsing tiers failed`, output cut to ~2000 chars). I worked around this by invoking `./node_modules/.bin/vitest.CMD` directly for the full-suite run to get a trustworthy pass/fail count. This is a local tooling quirk unrelated to the task itself.

## Commit

`ed77799` — `feat: render the real accuracy/winner summary in ReviewTab`
Files staged/committed: `src/lib/components/ReviewTab.svelte`, `src/lib/components/ReviewTab.test.ts` only.

---

## Addendum: fix for whole-branch review finding — fabricated 100% accuracy before analysis ready

### Bug confirmed

`startReview()` in `src/lib/stores/app-state.svelte.ts` seeds `appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0)` (full-length zeros) before `refreshRealAnalysis()` resolves. The original `ReviewTab.svelte` code (`getAccuracySummary(appState.game!, evalPerPly)`) passed this placeholder straight into `computeGameAccuracy`, which only guards on `evalPerPly.length < 2` — a full-length zero array passes that guard, so every ply scores as zero-loss and both sides show a fabricated `100.0` accuracy. This persists throughout `analysisStatus === 'loading'`, and indefinitely if analysis fails (`analysisStatus === 'error'`), since the placeholder zeros are never replaced.

### Fix

Minimal, surgical change confined to `src/lib/components/ReviewTab.svelte`. Changed the `$derived` accuracy computation to only pass the real `evalPerPly` prop through when `appState.analysisStatus === 'ready'`; otherwise it passes `[]`, which `computeGameAccuracy`'s existing `length < 2` guard already turns into `{ white: null, black: null }` — rendered as `—` by `AccuracyBlock`. No changes were needed to `accuracy.ts`'s public contract, `review.ts`'s `getAccuracySummary` signature, or `app-state.svelte.ts` — the fix is entirely a "what do I pass in" decision that `ReviewTab.svelte` already had all the information for (it imports `appState` directly). This uniformly covers `idle`, `loading`, and `error` states.

```svelte
const accuracy = $derived(
	getAccuracySummary(appState.game!, appState.analysisStatus === 'ready' ? evalPerPly : [])
);
```

### RED (test added to reproduce the bug, run against pre-fix code)

New test in `src/lib/components/ReviewTab.test.ts`: sets `appState.analysisStatus = 'loading'`, renders with `evalPerPly: new Array(2).fill(0)` (mirrors `startReview()`'s placeholder for the fixture's 1-move game), asserts no `'100.0'` text and both `.accuracy-grid .chip.sbmono` chips read `—`.

Command: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Result: `PASS (4) FAIL (1)` — new test failed with:
```
AssertionError: expected <div …(1)></div> to be null
  at ReviewTab.test.ts:60:32
```
(the `queryByText('100.0')` assertion failed because the div existed, i.e. `100.0` was rendered) — bug reproduced.

### GREEN (after the `.svelte` fix)

Command: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Result: `PASS (5) FAIL (0)` — new test passes; all 4 pre-existing tests pass unchanged (none of them assert a specific accuracy number, only winner label / breakdown / phase table / overlay text, so they were unaffected by the stricter gating — and none of them set `appState.analysisStatus = 'ready'`, so this fix does not silently mask a hole in their coverage of the "ready" case, it simply doesn't exercise it).

### Full suite

Command: `pnpm exec vitest run` (via `rtk proxy` to bypass output truncation)
Result: `Test Files 47 passed (47)`, `Tests 222 passed (222)`.

### `pnpm check`

Result: `COMPLETED 470 FILES 0 ERRORS 14 WARNINGS 6 FILES_WITH_PROBLEMS` — the 14 warnings are pre-existing a11y/unrelated warnings in other files (`MoveList.svelte`, `Board.svelte`, `NavControls.svelte`, `ExploreTab.svelte`, `OnboardingScreen.svelte`, `TitleBar.svelte`), none introduced by this change.

### Files changed

- `src/lib/components/ReviewTab.svelte` — gated the `accuracy` `$derived` on `appState.analysisStatus === 'ready'`.
- `src/lib/components/ReviewTab.test.ts` — added the reproducing regression test.

### Commit

`9a528a0` — `fix: don't show fabricated 100% accuracy before analysis is ready`

### Self-review

- Change is a single conditional at the call site; `accuracy.ts` and `review.ts` contracts untouched, per the task's constraint.
- Confirmed via full suite that no other consumer of `getAccuracySummary`/`computeGameAccuracy` was affected.
- Verified the fix does not depend on `evalPerPly`'s content being zero specifically — it's gated purely on `analysisStatus`, so it also correctly suppresses the accuracy display for any other not-yet-ready state, not just the zero-placeholder case described in the bug report.
- No lingering test pollution: `appState.analysisStatus = 'loading'` set in the new (last) test in this file does not affect other test files, confirmed by the full suite passing.

### Concerns

None. The fix is minimal, addresses all three problematic states (`idle`/`loading`/`error`) uniformly, and both the targeted regression test and the full suite pass.
