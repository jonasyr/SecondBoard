# Iteration 12 Task 4: Loosen Great's Not-Already-Decided Guard

## Status

Complete.

## Implementation

- Updated the existing decisively-won fixture from a mover win percentage of 98 to 99.25 so it still exercises the raised guard.
- Added a discriminating regression test at `beforePov = 98`, with an exact 20-point second-line gap.
- Changed only `GREAT_NOT_ALREADY_DECIDED` in production code, from 97 to 99.
- Preserved `BRILLIANT_NOT_WINNING = 97`, all Brilliant classification logic, and `GREAT_ONLY_MOVE_GAP = 20`.

## RED Evidence

Command:

```text
rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts
```

Result: exit 1; 1 test file failed; 1 failed and 18 passed out of 19 tests.

```text
FAIL  src/lib/game/classify.test.ts > classifyGame with special classes > classifies an only-move gap as great in a clearly-but-not-decisively winning position
AssertionError: expected 'best' to be 'great' // Object.is equality

Expected: "great"
Received: "best"
```

This is the expected failure under `GREAT_NOT_ALREADY_DECIDED = 97`: `beforePov = 98` is blocked by the old guard.

## GREEN Evidence

Command:

```text
rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts
```

Result: exit 0; 1 test file passed; 19/19 tests passed.

## Full JavaScript Suite

Command (run once after focused GREEN and before commit):

```text
rtk proxy pnpm exec vitest run
```

Result: exit 0; 52/52 test files passed; 292/292 tests passed.

## Files

- `src/lib/game/classify.ts`
- `src/lib/game/classify.test.ts`

Only these two files were included in commit `f1c9f87`:

```text
fix(classify): loosen Great's not-already-decided guard from 97 to 99
```

This report and pre-existing `.superpowers` / `.codebase-memory` working-tree changes were not committed.

## Self-Review

- Confirmed the new test is discriminating: it failed under 97 and passed under 99.
- Confirmed the updated 99.25 fixture remains outside the strict `beforePov < 99` Great guard.
- Confirmed the production diff is a single constant-value change.
- Confirmed Brilliant behavior and thresholds are untouched.
- Confirmed `GREAT_ONLY_MOVE_GAP` remains 20.
- `git diff --check` passed before commit.
- Confirmed the commit contains only the two requested source files.

## Concerns

The full suite passed but emitted existing Svelte compiler accessibility/reactivity warnings in `MoveList.svelte`, `Board.svelte`, `OnboardingScreen.svelte`, `ExploreTab.svelte`, and `NavControls.svelte`. They are unrelated to this classifier-only change. No Task 4 correctness concerns remain.

## Fix Round: Great Gap Fixture Boundary

Reviewer verification found that the new `beforePov = 98` test's second-PV fixture produced 70, making the actual gap 28 rather than the documented threshold boundary of 20. The fixture is now `[600, 360, 40]`, producing 78 and an exact `98 - 78 = 20` gap. The decisive-position fixture's stale comment was also corrected from 28 to the actual `99.25 - 70 = 29.25` gap. No production code changed.

Command:

```text
rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts
```

Output:

```text
RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard

Test Files  1 passed (1)
     Tests  19 passed (19)
  Duration  694ms (transform 56ms, setup 0ms, import 74ms, tests 7ms, environment 501ms)
```

Result: exit 0.

Separate focused fix commit:

```text
bad7a72 test(classify): correct Great gap fixtures at the threshold boundary
```
