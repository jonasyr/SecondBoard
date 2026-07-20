# Task 2 Report: TS API + store — thread `result` through to `GameData`

## What was implemented

Threaded the Rust `pgn::ParsedGame.result: Option<String>` field (added in Task 1) through the TypeScript layer end-to-end:

1. `src/lib/api/pgn.ts` — added `result: string | null` to the `ParsedGame` interface.
2. `src/lib/game/review.ts` — added `result: string | null` to the `GameData` interface.
3. `src/lib/stores/app-state.svelte.ts` — `startReview()`'s object literal now sets `result: parsed.result ?? null` when building `appState.game`.

## What was tested and results

Added two new tests to `src/lib/stores/app-state.test.ts` in the `describe('startReview (real PGN parsing)')` block, exactly per the brief:
- `threads the parsed Result tag into game.result` — mocks `parsePgn` resolving with `result: '1-0'`, asserts `appState.game!.result === '1-0'`.
- `defaults game.result to null when the PGN has no Result tag` — mocks `parsePgn` resolving without a `result` field, asserts `appState.game!.result === null`.

### TDD Evidence

**RED** — `pnpm exec vitest run src/lib/stores/app-state.test.ts`:
```
PASS (14) FAIL (2)

1. startReview (real PGN parsing) threads the parsed Result tag into game.result
   AssertionError: expected undefined to be '1-0'
2. startReview (real PGN parsing) defaults game.result to null when the PGN has no Result tag
   AssertionError: expected undefined to be null
```

**GREEN** — after adding `result` to `ParsedGame`, `GameData`, and the `startReview` assignment (`result: parsed.result ?? null`):
```
pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/AnalysisTab.test.ts src/routes/page.test.ts src/lib/components/ReviewPanel.test.ts src/lib/components/GameReviewScreen.test.ts
EXIT:0
```
All targeted suites pass; only pre-existing, unrelated svelte-compiler a11y/state warnings appear in the console output (from `.svelte` files this task never touched) — no test failures.

`pnpm check`:
```
1784283818630 COMPLETED 468 FILES 0 ERRORS 15 WARNINGS 6 FILES_WITH_PROBLEMS
```
0 errors. The 15 warnings are all pre-existing (a11y click-handler warnings in MoveList/ExploreTab/OnboardingScreen, `state_referenced_locally` in Board.svelte, `Unknown property: 'app-region'` in TitleBar.svelte) and unrelated to this change.

## Files changed

Per the brief:
- `src/lib/api/pgn.ts` — added `result: string | null` to `ParsedGame`.
- `src/lib/game/review.ts` — added `result: string | null` to `GameData`.
- `src/lib/stores/app-state.svelte.ts` — `startReview()` now sets `result: parsed.result ?? null`.
- `src/lib/game/review.test.ts` — added `result: null` to `sampleGame` and `notSampleGame` fixtures (the `realGame` spread-fixture inherits it via `...notSampleGame`, as the brief predicted, no direct edit needed there).
- `src/lib/stores/app-state.test.ts` — added the two new tests specified in the brief.
- `src/lib/components/AnalysisTab.test.ts` — added `result: null` to the `appState.game` fixture.

Extra fixtures found beyond the brief's named three (via `grep -rn "blackRating: null" src/`) and fixed the same way:
- `src/routes/page.test.ts` — `loadSampleGame()`'s `appState.game` literal.
- `src/lib/components/ReviewPanel.test.ts` — `beforeEach`'s `appState.game` literal.
- `src/lib/components/GameReviewScreen.test.ts` — `beforeEach`'s `appState.game` literal.

## Self-review findings

- `ParsedGame.result` and `GameData.result` are both typed exactly `string | null` (not `string | undefined`), matching the brief.
- `startReview()` uses `parsed.result ?? null`, so a mocked/real response that omits the field entirely (`undefined`) still produces `null` on `appState.game.result`, not `undefined` — verified directly by the second new test.
- Searched the whole `src/` tree for `GameData`-shaped literals (`grep -rn "blackRating: null" src/`) and found 5 total fixture sites, not just the 3 the brief named; all 5 now include `result: null`. Every `GameData` object literal in the repo includes `blackRating` as its last scalar field, so this grep is exhaustive for the shape — no other construction sites exist.
- Full targeted test run and `pnpm check` both clean; no new warnings introduced by these changes (all warnings present both before and after are in unrelated `.svelte` files).

## Concerns

None. The change is a pure type/plumbing addition with no behavioral changes to existing consumers; `getReviewPly`/`getPlayerRows` and all UI components ignore the new field for now, as expected — later tasks (3-6) will consume `GameData.result`.
