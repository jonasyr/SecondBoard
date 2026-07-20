# Task 6 Report: Wire the special-class inputs through `app-state.svelte.ts`

## Status: DONE

Note: this file previously held a stale report from an earlier iteration's differently-numbered
Task 6 (`engine-analysis.ts` wdlPerPly work, already covered by this iteration's Task 3 report).
That content has been replaced with this task's actual report below.

## Pre-edit verification (per brief instructions)

Read `src/lib/stores/app-state.test.ts` in full before touching any code. Confirmed:
- The "returns the exact default state from LOGIC.md §1" test (`createAppState`) asserts individual
  fields one-by-one via `expect(state.X).toBe(...)` — it never does a whole-object `toEqual`/snapshot
  against `defaultState`, so adding two new `AppState` fields cannot break it.
- No other test in the file does a full-shape comparison of `appState`/`defaultState` either
  (`startReview`, `refreshRealAnalysis`-adjacent tests all check specific fields, e.g.
  `expect(appState.wdlPerPly).toEqual([...])`, never a bulk object comparison).
- Several `loadRealAnalysis` mocks in this file resolve with objects that omit
  `secondEvalPerPly`/`secondWdlPerPly` (e.g. `{ evalPerPly: [], bestMoves: {} }`), which after
  destructuring assigns `appState.secondEvalPerPly = undefined` momentarily — harmless since no test
  asserts on those two fields.

Conclusion: the additive changes described in the brief carry no regression risk against this test
file's actual assertions.

Also cross-checked the brief's snippets against the actual, already-merged Task 3/Task 5 code:
- `src/lib/game/engine-analysis.ts`: `RealAnalysis` already has `secondEvalPerPly: (number | null)[]`
  and `secondWdlPerPly: (Wdl | null)[]`, and `loadRealAnalysis` already returns them — matches brief.
- `src/lib/game/classify.ts`: `classifyGame(evalPerPly, wdlPerPly?, special?: SpecialClassInputs)` and
  `SpecialClassInputs { positions, moveMeta, bestMoves, secondEvalPerPly?, secondWdlPerPly? }` already
  exist — matches brief exactly, no drift to reconcile.

## Implementation

Modified `src/lib/stores/app-state.svelte.ts` exactly per the brief, in 3 steps:

1. Added `secondEvalPerPly: (number | null)[]` and `secondWdlPerPly: (Wdl | null)[]` to the
   `AppState` interface (right after `wdlPerPly`) and to `defaultState` (both defaulting to `[]`).
2. Reset both fields to `[]` inside `startReview`, alongside the existing `classCodes`/`wdlPerPly`
   reset (fresh-parse reset, before real analysis lands).
3. In `refreshRealAnalysis`: destructured `secondEvalPerPly`/`secondWdlPerPly` out of
   `loadRealAnalysis`'s result, assigned them onto `appState`, and passed a `SpecialClassInputs`
   object as the third argument to `classifyGame`:
   ```typescript
   appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
   	positions: appState.game!.positions,
   	moveMeta: appState.game!.moveMeta,
   	bestMoves,
   	secondEvalPerPly,
   	secondWdlPerPly
   });
   ```

## Test run

Command: `rtk proxy pnpm exec vitest run`

Result:
```
Test Files  50 passed (50)
     Tests  274 passed (274)
```
Only pre-existing Svelte a11y/reactivity lint warnings printed (Board.svelte, MoveList.svelte,
OnboardingScreen.svelte, ExploreTab.svelte, NavControls.svelte) — unrelated to this change, no test
failures.

## Self-review

- Diff matches the brief's Step 1/2/3 snippets verbatim (field order, reset order, and the
  `classifyGame` special-inputs object shape all match character-for-character).
- Only `src/lib/stores/app-state.svelte.ts` was staged and committed — the working tree also carries
  unrelated pre-existing modifications to `.superpowers/sdd/*` docs and an untracked plan file from
  earlier work on this branch; none of those belong to this task and none were touched.
- Confirmed `app-state.svelte.ts` is the sole consumer of `classifyGame`/`loadRealAnalysis` in the
  repo (per the brief's "Interfaces" section) — no other call site needed updating.
- The two new `AppState` fields are purely additive (default `[]`, reset alongside existing arrays,
  populated alongside existing arrays) — no existing behavior changed, consistent with the full
  274-test pass with zero modifications to any test file.

## Commit

```
268dd3736ab93f13a626f442f82a57d761806862 feat(app-state): thread the engine's second PV line into classifyGame's special-class inputs
```

1 file changed (`src/lib/stores/app-state.svelte.ts`): 17 insertions(+), 2 deletions(-).
No `Co-Authored-By` trailer added, per explicit instruction for this session.

## Concerns

None. Task is complete and self-contained.
