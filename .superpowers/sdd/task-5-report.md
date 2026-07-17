# Task 5 Report: `review.ts` rewrite — `GameData`, real position/move consumption

## Status: DONE

## What was implemented (step by step)

1. **Step 1/2** — Replaced `src/lib/game/review.test.ts` verbatim with the brief's version (local `sampleGame`/`notSampleGame` fixtures, `getReviewPly`/`getPlayerRows` now called with an explicit `game` argument). Ran `pnpm vitest run src/lib/game/review.test.ts` — confirmed failure (`TypeError: Cannot read properties of undefined (reading 'toFixed')`, since the old `getReviewPly` signature didn't accept `game`).

2. **Step 3/4** — Replaced `src/lib/game/review.ts` verbatim with the brief's version: added `export interface GameData`, `export const UNCLASSIFIED_COACH_TEXT`, changed `getReviewPly`/`getPlayerRows` to require a `game: GameData` parameter (no default), sourced `position`/`lastMove`/`sanList` lookups from `game.*` instead of `MOCK_POSITIONS`/`MOCK_MOVE_META`/`SAN_LIST`, and gated `classCode` (and therefore `best`/non-intro `coachText`) on `game.isSample`. Ran the test file again — all 10 tests passed.

3. **Step 4b** — Reconciled `src/lib/stores/app-state.svelte.ts`: removed the local duplicate `export interface GameData { ... }` block, changed the import from `import type { Move, Position } from '$lib/board/types';` to `import type { Move } from '$lib/board/types';` plus a new `import type { GameData } from '$lib/game/review';`. Kept the `Move` import (not dropped) because `AppState.bestMoves: Record<number, Move & { san: string }>` still references it; dropped `Position` since nothing in the file uses it once the local `GameData` block is gone. Ran `pnpm vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts` — 23 passed, pure refactor confirmed with no assertion changes needed.

4. **Step 5** — Updated call sites:
   - `src/lib/components/GameReviewScreen.svelte`: `getReviewPly`/`getPlayerRows` now pass `appState.game!` as the brief specifies.
   - `src/lib/components/AnalysisTab.svelte`: `getReviewPly` now passes `appState.game!`.

5. **Step 6** — Updated the two named test files plus two additional test files discovered to break under full-suite run (see "Issues" below):
   - `src/lib/components/GameReviewScreen.test.ts`: added a `beforeEach` fixture setting `appState.game` from `SAN_LIST`/`MOCK_POSITIONS`/`MOCK_MOVE_META` (`$lib/game/mock-data`), `isSample: true`, so behavior is byte-identical to the previous mock-only wiring.
   - `src/lib/components/AnalysisTab.test.ts`: added the same `beforeEach` fixture.
   - Checked for the async `startReview()` heads-up mentioned in my task instructions: grepped `src/lib/components/` and `src/lib/stores/` for `startReview` call sites — confirmed `GameReviewScreen.test.ts` does **not** call `startReview()` anywhere (it only sets `appState.gameLoaded`/`screen`/`ply` etc. directly), so there was nothing to `await` there. That heads-up did not apply to this file as written; no action was needed on that specific point.
   - Additionally discovered (running the full suite) that `src/lib/components/ReviewPanel.test.ts` and `src/routes/page.test.ts` also broke, because they render `ReviewPanel`/`+page.svelte` (which nest `AnalysisTab`/`GameReviewScreen`) without ever setting `appState.game`, previously relying on the mock defaults. These two files aren't in the brief's file list, but leaving them broken would fail the full suite and contradict the self-review checklist's expectation ("full suite passes except the one deferred `OnboardingScreen.test.ts` failure"), so I fixed them too:
     - `ReviewPanel.test.ts`: added the same `appState.game` fixture to its `beforeEach`.
     - `page.test.ts`: added a `loadSampleGame()` helper and called it in the two tests that set `appState.gameLoaded = true` directly (bypassing `startReview()`).

6. **Step 7** — Committed as `bbd25e7`: `feat: wire review.ts to real per-game positions/moves via GameData`, including the two additional test files (`ReviewPanel.test.ts`, `page.test.ts`) alongside the brief's listed files (excluding `app-state.test.ts`, which needed no changes).

## Tests run and results

| Stage | Command | Result |
|---|---|---|
| Step 2 (red) | `pnpm vitest run src/lib/game/review.test.ts` | FAIL (as expected — old signature) |
| Step 4 (green) | `pnpm vitest run src/lib/game/review.test.ts` | PASS (10/10) |
| Step 4b | `pnpm vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts` | PASS (23/23) |
| Step 6 | `pnpm vitest run src/lib/components/GameReviewScreen.test.ts src/lib/components/AnalysisTab.test.ts` | PASS (8/8) |
| Extra fix verification | `pnpm vitest run src/lib/components/ReviewPanel.test.ts src/routes/page.test.ts src/lib/components/OnboardingScreen.test.ts` | PASS (10/11) — 1 expected failure in `OnboardingScreen.test.ts` (`"Start Review" loads the game regardless of textarea contents`, pre-existing async-timing issue from Task 4's `startReview()` becoming async; explicitly out of scope for this task) |
| Full suite | `pnpm run test -- --run` | 186/187 passed; 1 failed (the same `OnboardingScreen.test.ts` test above, the sole expected/deferred failure) |

## Files changed

- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/review.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/review.test.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/stores/app-state.svelte.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/components/GameReviewScreen.svelte`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/components/GameReviewScreen.test.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/components/AnalysisTab.svelte`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/components/AnalysisTab.test.ts`
- `/home/jonas/Documents/Code/SecondBoard/src/lib/components/ReviewPanel.test.ts` (not in brief's file list; fixed to keep full suite green)
- `/home/jonas/Documents/Code/SecondBoard/src/routes/page.test.ts` (not in brief's file list; fixed to keep full suite green)

## Self-review findings

- `review.ts` exports `GameData` and `UNCLASSIFIED_COACH_TEXT`; `getReviewPly` requires `game` (no default) — confirmed by reading the final file.
- Classification (`classCode`/`best`) is gated on `game.isSample && ply > 0`; `coachText` falls back to `UNCLASSIFIED_COACH_TEXT` for non-sample games (verified by the `notSampleGame` test case, which passed).
- `app-state.svelte.ts` reconciled: local `GameData` duplicate removed, now imports `GameData` from `$lib/game/review`; `Move` import kept (still used by `bestMoves`), `Position` import dropped (no longer referenced).
- `GameReviewScreen.svelte`/`AnalysisTab.svelte` both pass `appState.game!` through to `getReviewPly`/`getPlayerRows`.
- Checked `GameReviewScreen.test.ts` for the async `startReview()` heads-up — it turned out not to call `startReview()` at all (grepped to confirm), so there was no call site to `await`. The `appState.game` fixture was added per Step 6 as required.
- Full suite passes except the one explicitly-deferred `OnboardingScreen.test.ts` failure (the real async-`startReview()`-without-await issue, confirmed to be exactly what the task instructions anticipated for that file, tracked for a later task).

## Issues / concerns

- The brief's Step 6 only named `GameReviewScreen.test.ts` and `AnalysisTab.test.ts`, and its file list didn't include `ReviewPanel.test.ts` or `page.test.ts`. Both broke once `getReviewPly`/`getPlayerRows` started requiring non-null `game` data, because they render components that nest `AnalysisTab`/`GameReviewScreen` without ever populating `appState.game`. I fixed both (same fixture pattern) rather than leave the full suite red, since the task's own self-review checklist expects the full suite to pass except for the one deferred `OnboardingScreen.test.ts` case. Flagging this here in case the plan wants these listed explicitly in the brief for future tasks' traceability.
- No other concerns — the async-`startReview()` heads-up for `GameReviewScreen.test.ts` did not actually apply (no `startReview()` call site existed there); this is a discrepancy between the pre-task heads-up and the file's actual content, noted for the record but not a blocker.
