# Task 5 Report: Extend `classifyGame` with Brilliant/Great/Miss

## Summary

Extended `src/lib/game/classify.ts` so `classifyGame` can produce `'brilliant'`,
`'great'`, and `'miss'` classifications in addition to the existing 6 EP-cutoff
classes, gated behind a new optional third parameter (`special?:
SpecialClassInputs`). The existing 2-argument call signature is unchanged —
omitting `special` reproduces the pre-Task-5 behavior byte-for-byte (verified
by the pre-existing regression test plus a new explicit fallback test).

Note: an earlier, stale version of this report file (from a prior plan
iteration's differently-numbered "Task 5", which added WDL support to
`classifyGame` — that work is already merged into `main` separately) has been
replaced by this report.

## Process (TDD)

1. Read `src/lib/game/classify.test.ts` in full first (via the `Read` tool) to
   confirm its exact existing imports/conventions (plain `describe`/`it`/`expect`
   from `vitest`, fixtures constructed inline per test, no shared fixture
   helpers) before adding to it.
2. Appended the `describe('classifyGame with special classes', ...)` block
   from the brief verbatim (4 tests: brilliant, great, miss, EP-cutoff
   fallback), and added one import at the top of the test file:
   `import type { Move, Position } from '$lib/board/types';` (needed for the
   `Position[]`/`Move[]` fixture type annotations used by the new tests; no
   existing import in the file covered these types).
3. Ran `pnpm exec vitest run src/lib/game/classify.test.ts` before touching
   `classify.ts` — confirmed 3 of the 4 new tests failed as expected (all
   fell through to the pre-existing EP-cutoff table, producing `best`,
   `best`, and `blunder` instead of `brilliant`, `great`, `miss`
   respectively); the 4th new test (fallback) and all 11 pre-existing tests
   passed, since they exercise the unchanged 2-arg path.
4. Implemented the code from the brief in `classify.ts`:
   - Added imports: `Move`, `Position` from `$lib/board/types`; `isMaterialSacrifice` from `./material` (Task 4).
   - Added constants `BRILLIANT_MIN_WIN` (50), `BRILLIANT_NOT_WINNING` (97), `GREAT_ONLY_MOVE_GAP` (10), `MISS_WIN_BEFORE` (80), `MISS_WIN_AFTER` (55).
   - Added `export interface SpecialClassInputs { positions, moveMeta, bestMoves, secondEvalPerPly?, secondWdlPerPly? }`.
   - Added `secondLineWinPercent()` helper — prefers the second PV line's WDL data, falling back to its eval (sigmoid) when WDL is absent.
   - Added a third optional parameter `special?: SpecialClassInputs` to `classifyGame`, threading `classifySpecial(...) ?? classifyMoveByEpLoss(epLoss)` per ply instead of calling `classifyMoveByEpLoss` unconditionally.
   - Added `classifySpecial()`: checks Brilliant first (near-best played move + a material sacrifice on that ply + the mover's win% stays at/above 50 afterward + wasn't already >=97 before, i.e. not a "free" sac in an already-won position), then Great (played move exactly matches the engine's top suggestion AND the gap to the second-best PV line's win% is >=10 points), then Miss (mover's win% was >=80 before and drops below 55 after) — each returns `null` when its condition doesn't hold, falling through to the next check and ultimately to the deterministic cutoff table.
   - Updated the module's header doc comment to state the new override order (Brilliant > Great > Miss > cutoffs) and note that Book/Forced remain future work.
5. Re-ran `pnpm exec vitest run src/lib/game/classify.test.ts` — all 15 tests (11 pre-existing + 4 new) passed.
6. Ran `pnpm exec tsc --noEmit -p .` — no type errors.
7. Ran the full suite `pnpm exec vitest run` — 50 test files, 274 tests, all passed (pre-existing Svelte a11y/reactivity warnings from unrelated components in the console output; no new warnings introduced by this change).

## Exact test output (final, passing run)

Targeted file:
```
 RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard


 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  18:32:04
   Duration  698ms (transform 47ms, setup 0ms, import 64ms, tests 6ms, environment 508ms)
```

Full suite:
```
 Test Files  50 passed (50)
      Tests  274 passed (274)
   Start at  18:32:17
   Duration  10.84s (transform 13.06s, setup 0ms, import 29.22s, tests 8.93s, environment 62.02s)
```

Pre-implementation (failing) run, for the record:
```
 ❯ src/lib/game/classify.test.ts (15 tests | 3 failed) 13ms
     × classifies a best/near-best sound piece sacrifice as brilliant
         expected [ 'best' ] to deeply equal [ 'brilliant' ]
     × classifies an only-move (large MultiPV gap) best move as great
         expected [ 'best' ] to deeply equal [ 'great' ]
     × classifies a failure to punish a winning position as miss
         expected [ 'blunder' ] to deeply equal [ 'miss' ]

 Test Files  1 failed (1)
      Tests  3 failed | 12 passed (15)
```

## Self-review

- Confirmed the 2-arg call signature is preserved exactly: `classifyGame(evalPerPly, wdlPerPly)` and `classifyGame(evalPerPly)` both still work, and the "falls back to the EP-cutoff table when no special condition matches" test (which calls `classifyGame(evalPerPly)` with no `special` arg) passes — `special` defaults to `undefined` and `classifySpecial` short-circuits via `if (!special) return null;`, so the fallback path is byte-for-byte the pre-existing behavior.
- Verified the override order matches the brief/blueprint: Brilliant is checked before Great, which is checked before Miss, each returning early on a match; `classifyMoveByEpLoss(epLoss)` only runs when `classifySpecial` returns `null`.
- Verified `isMaterialSacrifice` (Task 4's `material.ts`) is consumed exactly per its documented contract (mover-relative material swing between the before/after positions of that ply, >=3 points net loss), and `secondLineWinPercent` prefers WDL over the eval-sigmoid fallback consistent with how `winPercentForPly` in `accuracy.ts` already does this for the primary line (same sigmoid coefficient, `0.00368208`).
- Ran `tsc --noEmit` — no errors, confirming `Move & { san: string }` and `Record<number, ...>` for `bestMoves` line up with how `RealAnalysis.bestMoves`/`AppState.bestMoves` are typed elsewhere (Task 3).
- `ClassCode` already included `'brilliant'`, `'great'`, and `'miss'` in `src/lib/types/index.ts` from an earlier commit, so no type-union changes were needed there.
- No other call sites of `classifyGame` needed changes (Task 6, per the brief, is the consumer that will pass `special` from `app-state.svelte.ts`; that wiring is explicitly out of scope for this task).

## Files changed

- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/classify.ts` — implementation (new `SpecialClassInputs` interface, `secondLineWinPercent` helper, `classifySpecial` function; `classifyGame`'s signature and body updated; header doc comment updated).
- `/home/jonas/Documents/Code/SecondBoard/src/lib/game/classify.test.ts` — new `describe('classifyGame with special classes', ...)` block (4 tests) plus one added type-only import (`Move`, `Position` from `$lib/board/types`).
- `/home/jonas/Documents/Code/SecondBoard/.superpowers/sdd/task-5-report.md` — this report (replaces a stale report left over from an earlier, differently-scoped plan iteration).

## Commit

Committed to branch `feat/special-move-classes`.
