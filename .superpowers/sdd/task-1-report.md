# Task 1 Report: Widen Brilliant's material-sacrifice detection window

## Status: DONE

## Commit

`c6243a1` — "fix(classify): widen Brilliant's sacrifice check to see material given up on the opponent's next reply"

Files changed: `src/lib/game/classify.ts`, `src/lib/game/classify.test.ts` (72 insertions, 2 deletions).

Branch: `feat/special-move-classes`.

Note: two other files (`.superpowers/sdd/progress.md`, `.superpowers/sdd/task-1-brief.md`) had
pre-existing uncommitted modifications in the working tree that predate this task and were not
authored as part of this fix, so they were deliberately left out of the commit (only the two files
named in the brief were staged).

## Implementation

Root cause: `classifySpecial` (src/lib/game/classify.ts) compared `positions[ply - 1]` (before the
mover's move) against `positions[ply]` (immediately after the mover's own move) when calling
`isMaterialSacrifice`. This misses the extremely common "offered sacrifice" pattern where a piece
is left en prise on the mover's move but only actually captured on the opponent's next reply — e.g.
the reference game's own 17...Be6!!, which chess.com correctly classifies as Brilliant but this
codebase was classifying as Great (falling through past the sacrifice check since the same-ply
material diff is exactly 0).

Fix applied exactly as specified in the brief: introduced

```ts
const materialAfter = special.positions[ply + 1] ?? special.positions[ply];
```

and pass `materialAfter` instead of `special.positions[ply]` as the "after" board to
`isMaterialSacrifice`, keeping `special.positions[ply - 1]` as the "before" board unchanged. This
prefers the position after the opponent's very next reply when available, and falls back to
today's same-ply comparison when `positions[ply + 1]` doesn't exist (i.e., the played move was the
game's last ply) or is otherwise missing. No exported function signatures changed;
`isMaterialSacrifice`'s signature/module were untouched, matching the brief's "Consumes" note.

## TDD process

1. Added the two tests from the brief to the existing `describe('classifyGame with special
   classes', ...)` block in `src/lib/game/classify.test.ts`, immediately after the existing
   `'classifies a best/near-best sound piece sacrifice as brilliant'` test:
   - `'classifies an offered sacrifice (material lost only after the opponent's next reply) as
     brilliant'`
   - `'falls back to the same-ply material diff when the move played is the very last ply'`

2. Ran `pnpm exec vitest run src/lib/game/classify.test.ts` before the implementation change
   (`rtk` was not available/installed in this environment, so used the brief's documented plain
   `pnpm` fallback). Result matched the brief's prediction exactly:

   ```
   RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard
    ❯ src/lib/game/classify.test.ts (17 tests | 1 failed) 11ms
        × classifies an offered sacrifice (material lost only after the opponent's next reply) as brilliant

   AssertionError: expected 'best' to be 'brilliant'

    Test Files  1 failed (1)
         Tests  1 failed | 16 passed (17)
   ```

   Confirms: the new "offered sacrifice" test failed (codes[0] was `'best'`, not `'brilliant'`) and
   the new "fallback to same-ply" regression-lock test already passed, exactly as the brief
   described.

3. Applied the Step 3 code change verbatim as given in the brief.

4. Re-ran the same command:

   ```
   RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard
    Test Files  1 passed (1)
         Tests  17 passed (17)
   ```

   All 17 tests pass, including the pre-existing `'classifies a best/near-best sound piece
   sacrifice as brilliant'` test (a 2-ply fixture where `positions[ply+1]` is out of bounds, so it
   exercises the same fallback path as the new fallback regression test) and the new
   "offered sacrifice" test.

## Self-review

- Change is minimal and scoped exactly to the `classifySpecial` function's Brilliant branch; no
  other branches (Great, Miss, EP-cutoff table) or exported signatures were touched.
- `isMaterialSacrifice`'s signature and the `./material` module were not modified, per the brief's
  "Consumes" constraint.
- Verified the fallback path (`?? special.positions[ply]`) is exercised by two different tests now:
  the pre-existing 2-ply Brilliant test and the new explicit last-ply fallback test — both pass.
- No other test files or call sites reference `classifySpecial` directly (it's not exported), so no
  broader regression surface was in scope for this task.
- Did not investigate whether `isMaterialSacrifice` itself has any independent bugs — out of scope
  per the brief (its signature/behavior is explicitly "unchanged").

## Test summary

17/17 tests pass in `src/lib/game/classify.test.ts` (15 pre-existing + 2 new), full command:
`pnpm exec vitest run src/lib/game/classify.test.ts`.

## Concerns

None. The change matches the brief's prescribed diff exactly, both new tests behaved as predicted
before and after the fix, and the full test file passes.

## Fix: guard the widened sacrifice window against unrelated captures elsewhere on the board

A reviewer flagged that the widened Brilliant sacrifice check added above was "causally blind": it
diffs total material balance between `positions[ply - 1]` and `positions[ply + 1]` without checking
that the swing is actually caused by the piece the mover just moved. A genuinely quiet move,
followed by the opponent capturing some unrelated piece that was already hanging elsewhere on the
board, would still show a >=3-point swing and wrongly get flagged `brilliant`.

### Change

`src/lib/game/classify.ts` (`classifySpecial`): after computing the widened-window candidate
(`special.positions[ply + 1]`), only trust it when the square the played move landed on
(`playedMove.to`) no longer holds a piece of the mover's own color in that widened position --
i.e. the mover's own piece was actually captured (or is otherwise gone) on the square it just moved
to. If the mover's piece is still safely sitting there, the widened window is discarded and the
code falls back to the same-ply comparison (`positions[ply - 1]` vs `positions[ply]`, today's
pre-Task-1 behavior), so an unrelated capture elsewhere can't inflate this move's classification.
The pre-existing immediate (same-ply) sacrifice case and the offered-sacrifice case (mover's piece
genuinely captured on its landing square after the opponent's reply) are both unaffected.

`src/lib/game/material.ts`: updated `isMaterialSacrifice`'s docstring (and the module header
comment) to describe the function generically as diffing two given board snapshots for the mover's
material-differential swing, rather than asserting a specific "measured immediately before the
opponent gets to reply" timing that the widened-window caller no longer honors universally --
picking which two snapshots to compare is documented as the caller's responsibility.

### New test (TDD: written first, confirmed failing, then fixed)

Added to `src/lib/game/classify.test.ts` (`classifyGame with special classes` describe block):
"does NOT classify a quiet move as brilliant just because the opponent's reply captures an
unrelated, already-hanging piece elsewhere on the board". Fixture: White plays a quiet king move
e1-e2 (nothing captured/offered); Black's reply captures an unrelated White rook on a1 that was
hanging independently. The widened window still shows a >=3-point material swing, but the king
safely occupies e2 the whole time, so this must not be `brilliant`.

Confirmed failing before the fix:
```
AssertionError: expected 'brilliant' not to be 'brilliant'
Test Files  1 failed (1)
     Tests  1 failed | 17 passed (18)
```

After the fix, focused file:
```
$ rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

Full suite:
```
$ rtk proxy pnpm exec vitest run
 Test Files  50 passed (50)
      Tests  277 passed (277)
```
(Pre-existing a11y lint warnings from vite-plugin-svelte print during the run; unrelated to this
change and not test failures.)

### Concerns

None. All 18 tests in `classify.test.ts` pass (17 pre-existing + 1 new), and the full suite (277
tests across 50 files) passes with no regressions.
