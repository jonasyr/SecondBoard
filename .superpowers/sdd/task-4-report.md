# Task 4 Report — appState: real PGN loading, `game` field, `getMaxPly`

## Status: DONE_WITH_CONCERNS

## Update (after coordinator guidance)

The coordinator confirmed the discrepancy below was a real gap in the brief, fixed the plan (commit `c11a267`), and provided exact replacement code for the three affected tests. Applied all three changes verbatim:

1. `screen/ply transitions > startReview resets to the default review state regardless of pgnText` — now `async`, sets `parsePgn.mockResolvedValue(...)` and `loadRealAnalysis.mockResolvedValue(...)` inline, `await startReview()`.
2. `real analysis loading` block's `beforeEach` — now resets and seeds `parsePgn.mockResolvedValue({ sanList: ['e4'], ... })` in addition to `loadRealAnalysis.mockReset()`.
3. Both tests in that block now `await startReview()` before asserting `analysisStatus`.

**Re-ran `pnpm vitest run src/lib/stores/app-state.test.ts`: 13/13 pass.**

Then ran the full suite (`pnpm run test -- --run`): **2 test files fail that are outside this task's scope** — `src/lib/components/GameReviewScreen.test.ts` (1 test) and `src/lib/components/OnboardingScreen.test.ts` (1 test). Confirmed via `git stash` that both passed before this task's changes and now fail because of it: both call `startReview()` (via a button click / keydown) and assert `appState.gameLoaded`/`appState.ply` synchronously immediately afterward, with no `await` — the same async-timing issue just fixed in `app-state.test.ts`, but in files not in this task's file list (`OnboardingScreen.svelte`'s test, and `GameReviewScreen.test.ts` which is Task 5/6 territory per the brief's explicit instruction not to touch `GameReviewScreen.svelte`/`AnalysisTab.svelte`). Per Step 7 of the brief ("other test files will still fail... do not attempt to fix unrelated failing files in this task"), I did not modify these two test files. Flagging here so whoever picks up Task 5/6 (or a follow-up) knows these two need the same `await startReview()` fix applied to `OnboardingScreen.test.ts` and `GameReviewScreen.test.ts`.

Confirmed `src/lib/api/pgn.test.ts` passes cleanly (1/1), per the brief's Step 7 requirement.

**Final full-suite result:** 45/47 test files pass, 184/186 individual tests pass; the 2 failures are the pre-existing-but-newly-broken-by-async-timing tests named above, out of this task's scope.

## Commit

```
751ad54 feat: wire startReview to real PGN parsing via the Rust pgn module
```

## Original investigation (discrepancy found, since resolved by coordinator)

## What was implemented so far

1. **`src/lib/game/sample-pgn.ts`** (new) — `SAMPLE_PGN` constant extracted verbatim from the old `OnboardingScreen.svelte` local copy.
2. **`src/lib/components/OnboardingScreen.svelte`**:
   - Replaced the local `const SAMPLE_PGN = ...` with `import { SAMPLE_PGN } from '$lib/game/sample-pgn';`.
   - Added the `{#if appState.parseError}<div class="parse-error">...</div>{/if}` banner above the `<textarea>`.
   - Added the `.parse-error` style block, using `var(--color-accent-red)` for the text color (confirmed via `src/app.css` — this is the existing CSS custom property for `TOKENS.classification.blunder.color` / `TOKENS.color.accentRed` = `#F26B6B`; there is no `--color-blunder` variable in this codebase, so per the brief's fallback instruction I reused the closest existing token instead of inventing a new hex value).
3. **`src/lib/stores/app-state.svelte.ts`**:
   - Updated imports (added `Position` type import, `parsePgn`, `SAMPLE_PGN`; removed `SAN_LIST`).
   - Added `GameData` interface locally (not imported from anywhere, as instructed — Task 5's job to relocate).
   - Added `game: GameData | null` and `parseError: string | null` to `AppState` and `defaultState`.
   - Replaced `export const MAX_PLY = SAN_LIST.length` with `export function getMaxPly(): number`.
   - Updated `goToPly` to clamp against `getMaxPly()`.
   - Replaced synchronous `startReview()` with the async version from the brief, calling `parsePgn()`, populating `appState.game`, handling the `isSample` flag, and setting `appState.parseError` on failure.
4. **`src/lib/components/ReviewPanel.svelte`** — swapped `MAX_PLY` import/usage for `getMaxPly()`.
5. **`src/lib/stores/app-state.test.ts`** — replaced per the brief: new mocks (`parsePgn`), new `getMaxPly` import, replaced the `MAX_PLY` test, updated the `goToPly` clamp test, and added the new `describe('startReview (real PGN parsing)', ...)` block with its three tests exactly as given in the brief.

## Test results

Ran `pnpm vitest run src/lib/stores/app-state.test.ts`.

**10 passed, 3 failed** — all 3 failures are in tests that were NOT supposed to need changes per the brief (the brief states "Every OTHER pre-existing test ... is unaffected by this change"), but they do fail, because `startReview()` is now `async` and none of these three call sites `await` it:

1. `screen/ply transitions > startReview resets to the default review state regardless of pgnText` — calls `startReview();` synchronously (no `await`), then immediately asserts `appState.gameLoaded === true` etc. Since `startReview` now does `await parsePgn(...)` before touching any state, the synchronous assertions run before the microtask that sets `gameLoaded`/`screen`/`ply` — so `gameLoaded` is still `false` at assertion time. Fails with `expected false to be true`.

2. `real analysis loading > goes loading -> ready and applies the real data on startReview success` — calls `startReview();` synchronously then immediately asserts `appState.analysisStatus === 'loading'`. Since `analysisStatus = 'loading'` is only set inside `refreshRealAnalysis()`, which is only invoked *after* `await parsePgn(...)` resolves (a microtask later), the synchronous assertion fires too early. It also compounds with stale `parsePgn` mock state carried over from the previous describe block (this test's own `beforeEach` only resets `loadRealAnalysis`, never `parsePgn`), since the mocks are hoisted, file-scoped singletons not reset between describe blocks. Observed actual value: `'ready'` (leftover from a previous test), expected `'loading'`.

3. `real analysis loading > goes loading -> error when loadRealAnalysis rejects` — same synchronous-call issue; observed `'ready'`, expected `'error'`.

These three tests are literally the brief's own unmodified text (copied verbatim from the task-4 brief into `app-state.test.ts`), so this isn't a typo I introduced — the brief's assumption that these three are "unaffected" does not hold now that `startReview` is `async`. Making `startReview` synchronous isn't an option (the brief explicitly requires it be `async` and `await parsePgn(...)`), so reconciling this requires either:
- Adding `await` at the three synchronous call sites (and, for the two `real analysis loading` tests, also arranging for `parsePgn` to resolve before the `loadRealAnalysis` promise is created so `analysisStatus` can still be observed mid-flight — e.g. giving `parsePgn` a `mockResolvedValue` in that describe's `beforeEach` and awaiting only up to the point where `refreshRealAnalysis()` has been invoked but its own promise hasn't resolved yet), or
- Some other interpretation/fix to the test file that I'm missing.

I did not make this call unilaterally since the brief explicitly names this exact scenario ("a test fails in a way the brief didn't anticipate") as a stop-and-report condition, and the fix requires modifying tests the brief said not to touch (or reordering describe blocks, which has its own knock-on effects on shared mock state).

## Files changed (uncommitted, working tree)
- `src/lib/game/sample-pgn.ts` (new)
- `src/lib/components/OnboardingScreen.svelte`
- `src/lib/stores/app-state.svelte.ts`
- `src/lib/stores/app-state.test.ts`
- `src/lib/components/ReviewPanel.svelte`

No commit has been made yet — holding until the test discrepancy above is resolved per guidance.

## Self-review against the checklist (as far as possible before resolving the blocker)
- `GameData` defined locally in `app-state.svelte.ts`, not imported — yes.
- `startReview()` is `async`, calls `parsePgn(appState.pgnText.trim() || SAMPLE_PGN)`, seeds `evalPerPly`/`bestMoves`, sets `parseError` on failure — yes.
- `getMaxPly()` reads `appState.game?.sanList.length ?? 0` (implemented as `appState.game ? appState.game.sanList.length : 0`, equivalent) — yes.
- `SAMPLE_PGN` lives in `src/lib/game/sample-pgn.ts`, old local copy removed from `OnboardingScreen.svelte`, replaced with import — yes.
- Onboarding error banner renders `appState.parseError`, uses existing token `var(--color-accent-red)` (no new hardcoded hex for the text color; background/border rgba values are as literally specified in the brief) — yes.
- `ReviewPanel.svelte`'s `MAX_PLY` usage now `getMaxPly()` — yes.
- All existing `app-state.test.ts` tests pass — **NO, 3 fail** (see above).
