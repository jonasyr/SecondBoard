# Iteration 12 Task 1 Report: Pure attack-detection module

## Status

DONE

## Commit

`4e75fba` — `feat(attacks): add a pure attacker/defender-count module for hanging-piece detection`

The commit contains only `src/lib/game/attacks.ts` and `src/lib/game/attacks.test.ts`.

## Implementation

- Added `src/lib/game/attacks.ts` with pure attack-square geometry for knights, kings, rooks, bishops, queens, and color-directed pawn captures.
- Sliding attacks stop at the first occupied square.
- Added `countAttackers(position, target, byColor)` and count-only `isPieceHanging(position, square, ownerColor)`.
- Ownership, empty-square, zero-attacker, equal-defender, edge-of-board, wrong-color, and multiple-attacker cases are covered.
- Square parsing matches `src/lib/board/geometry.ts`; types come from `src/lib/board/types.ts`.

## Files

- Created: `src/lib/game/attacks.ts`
- Test: `src/lib/game/attacks.test.ts`
- Report only, deliberately excluded from the commit: `.superpowers/sdd/task-1-report.md`
- `.superpowers/sdd/progress.md` and `.superpowers/sdd/task-1-brief.md` were not edited or committed by this task agent.

## TDD RED

Command:

```text
rtk proxy pnpm exec vitest run src/lib/game/attacks.test.ts
```

Exit code: `1`

Output:

```text
 RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard

 ❯ src/lib/game/attacks.test.ts (0 test)

 FAIL  src/lib/game/attacks.test.ts [ src/lib/game/attacks.test.ts ]
Error: Failed to resolve import "./attacks" from "src/lib/game/attacks.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /home/jonas/Documents/Code/SecondBoard/src/lib/game/attacks.test.ts:2:47

 Test Files  1 failed (1)
      Tests  no tests
   Duration  711ms
```

The failure was the required missing-production-module RED state.

## Plan contradiction and approved resolution

The initial implementation run produced 15 passes and one failure:

```text
FAIL  src/lib/game/attacks.test.ts > countAttackers > counts a queen attacking both orthogonally and diagonally
AssertionError: expected 2 to be 1
Test Files  1 failed (1)
Tests  1 failed | 15 passed (16)
```

The queen fixture placed a black queen on `d4` and a black king on `e8`, then expected one black attacker on `d8`. Both pieces attack `d8`: the queen along the d-file and the king from the adjacent `e8` square. The immediately preceding king test explicitly verifies the latter attack.

After escalation, the user authorized the minimal correction: move the queen-only fixture's black king from `e8` to `h8`. This preserves the assertion's queen-only intent and the implementation's normal chess geometry. No other test content changed.

## Focused GREEN

Command:

```text
rtk proxy pnpm exec vitest run src/lib/game/attacks.test.ts
```

Exit code: `0`

Output:

```text
 RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  668ms
```

## Full JavaScript suite

Command, run once after focused GREEN:

```text
rtk proxy pnpm exec vitest run
```

Exit code: `0`

Output summary:

```text
 Test Files  52 passed (52)
      Tests  295 passed (295)
   Duration  11.15s
```

The full run emitted existing Svelte compiler/accessibility warnings in `Board.svelte`, `MoveList.svelte`, `OnboardingScreen.svelte`, `ExploreTab.svelte`, and `NavControls.svelte`. These are unrelated to this pure TypeScript module and did not fail the suite.

## Self-review

- Reviewed the complete diff of both source files.
- Confirmed all six piece types are handled and each attack is counted at most once per source piece/direction.
- Confirmed rays terminate at the first occupied square regardless of piece color/type.
- Confirmed white pawns are found one rank below a target and black pawns one rank above it.
- Confirmed off-board coordinates return `null` and do not index invalid squares.
- Confirmed `isPieceHanging` requires a correctly owned piece, at least one opposing attacker, and strictly more attackers than defenders.
- Confirmed the only deviation from the original test text is the user-approved `e8` to `h8` fixture correction.
- Confirmed the intended commit scope is only `src/lib/game/attacks.ts` and `src/lib/game/attacks.test.ts`.

## Concerns

No implementation concerns. The full suite is green. Existing unrelated Svelte warnings remain as noted above.
