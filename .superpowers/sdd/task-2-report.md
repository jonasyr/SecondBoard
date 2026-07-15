# Task 2: Mock game data + mock chess engine (Iteration 4) — Implementation Report

> Note: this file previously held a stale report from an earlier iteration's
> unrelated "Task 2" (board domain types + geometry math). Overwritten below
> with the report for the current Iteration 4 Task 2 (mock engine/data split).

## Status: DONE

## What was implemented

Split `src/lib/board/dev-fixtures.ts` (Iteration 3 visual-verification harness) into:

- `src/lib/game/mock-engine.ts` — `standardBoard`, `clearPath`, `canReach`, `applySan`,
  `buildGame` copied verbatim (only import path for `Move`/`Piece`/`Position` changed
  from `'./types'` to `'$lib/board/types'`). Exports `buildGame`.
- `src/lib/game/mock-data.ts` — game data constants: `SAN_LIST`, `CLASS_CODES`,
  `EVAL_PER_PLY`, `BEST_MOVES`, plus the new fields `COACH_TEXT_MAP`, `BREAKDOWN_ROWS`,
  `PHASE_ROWS`, `PLAYERS` (and `PlayerInfo` interface), and derived `MOCK_POSITIONS`/
  `MOCK_MOVE_META` built via `buildGame(SAN_LIST)`.

`ClassCode` resolves from `src/lib/types/index.ts` (the brief's `$lib/types` import
path is correct — that's the barrel file, not a flat `types.ts`).

## Ground-truth cross-check (per task instructions)

Read both reference files directly:
- `design_handoff_secondboard/reference/logic/chess-mock.js` — exists, confirmed the
  engine functions in `dev-fixtures.ts`/the brief are a verbatim JS→TS port (same
  algorithm, same variable names, same control flow).
- `design_handoff_secondboard/reference/logic/data.js` — exists, confirmed every new
  field against source:
  - `coachTextMap` → matches `COACH_TEXT_MAP` exactly (all 10 codes, same text).
  - `breakdown` → matches `BREAKDOWN_ROWS` exactly (10 rows, same tuples).
  - `phases` → matches `PHASE_ROWS` exactly (3 rows, same tuples).
  - `players` → matches `PLAYERS` exactly, including `gameRating: '1712'` (white) /
    `'1994'` (black).
  - `sanList`, `classCodes`, `evalPerPly`, `bestMoves` also verified identical to what
    was already in `dev-fixtures.ts`.

**No corrections were needed.** Unlike Task 1's plan bug, this brief's transcribed
values for `mock-data.ts` matched `data.js` byte-for-byte on inspection. I added one
extra test assertion (`BEST_MOVES[14]`/`[30]` exact values) beyond the brief's test
list, purely as extra verification against the reference — not a correction.

## TDD evidence

RED (before creating implementation files):
```
FAIL  src/lib/game/mock-data.test.ts — Failed to resolve import "./mock-data"
FAIL  src/lib/game/mock-engine.test.ts — Failed to resolve import "./mock-engine"
```

GREEN (after creating `mock-engine.ts` and `mock-data.ts`):
```
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

Full suite after deleting the old fixture files:
```
 Test Files  1 failed | 23 passed (24)
      Tests  104 passed (104)
```
The 1 failed suite is `src/routes/page.test.ts`, failing only because
`src/routes/+page.svelte` still imports the now-deleted `$lib/board/dev-fixtures` —
expected per the brief, to be resolved by Task 19.

## Files changed

- Created: `src/lib/game/mock-engine.ts`, `src/lib/game/mock-data.ts`,
  `src/lib/game/mock-engine.test.ts`, `src/lib/game/mock-data.test.ts`
- Deleted (`git rm`): `src/lib/board/dev-fixtures.ts`, `src/lib/board/dev-fixtures.test.ts`
- Commit: `d9fb1b4` — "feat: add mock game engine and Italian Game review data"

## `grep -rn "dev-fixtures" src/` result

```
src\routes\+page.svelte:5:	import { DEV_GAME } from '$lib/board/dev-fixtures';
src\routes\+page.svelte:29:	// (avatars, eval bar, tabbed right panel). See board/dev-fixtures.ts.
src\lib\components\README.md:13:See ... `src/lib/board/dev-fixtures.ts`
```

Confirmed: only `+page.svelte` (import + a stale comment) and a doc comment in
`src/lib/components/README.md` remain. Both are out of scope for this task per the
brief (Task 19's job for `+page.svelte`; the README.md line is a comment, not code,
and not named in this task's file list).

## Self-review

- Verified engine functions are byte-identical in logic to the old `dev-fixtures.ts`
  version (only the import path changed).
- Verified `mock-data.ts`'s exported shapes match the brief's interface list exactly:
  `SAN_LIST`, `CLASS_CODES`, `EVAL_PER_PLY`, `BEST_MOVES`, `COACH_TEXT_MAP`,
  `BREAKDOWN_ROWS`, `PHASE_ROWS`, `PLAYERS`.
- Confirmed no other production code imports `dev-fixtures` besides `+page.svelte`.
- Did not touch `+page.svelte` or `README.md`, per scope instructions.

## Concerns

None. Ground truth matched the brief exactly; no unresolved conflicts.
