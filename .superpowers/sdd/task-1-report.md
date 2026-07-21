# Task 1: Port lichess's `Divider` Phase-Boundary Algorithm — Completion Report

## Summary
Successfully completed all steps of Task 1 following strict Test-Driven Development (TDD) as specified in the task brief. Ported the lichess open-source `Divider` algorithm (Scala) to TypeScript for detecting game phase boundaries (opening/middlegame/endgame).

## Status
DONE

## Commit Hash
`365bf51` — `feat(phase): port lichess's Divider algorithm for opening/middlegame/endgame boundaries`

The commit contains only `src/lib/game/phase.ts` and `src/lib/game/phase.test.ts`.

## Work Completed

### Step 1: Write the Failing Tests
Created `src/lib/game/phase.test.ts` with 8 test cases, verbatim from the brief:
- Test for staying in opening (no material/development trigger)
- Test for midgame detection via majorsAndMinors <= 10
- Test for midgame detection via backrankSparse
- Test for endgame detection via majorsAndMinors <= 6
- Test for nulling out middlePly when both triggers fire on same ply
- Test for never searching endgame without midgame
- Test for totalPlies reporting
- Test for mixedness > 150 on interleaved board

### Step 2: Confirmed Test Failure (RED)
Command:
```bash
pnpm exec vitest run src/lib/game/phase.test.ts
```

Exit code: `1`

Output:
```
Failed to resolve import "./phase" from "src/lib/game/phase.test.ts". Does the file exist?
```

This is the expected failure state confirming tests are ready before implementation.

### Step 3: Implement `dividePhases`
Created `src/lib/game/phase.ts` with:
- Exact line-for-line port of lichess's `Divider` algorithm
- Helper functions:
  - `fileOf(square)`: Extract file index from square notation
  - `rankOf(square)`: Extract rank number from square notation
  - `majorsAndMinors(position)`: Count pieces excluding kings and pawns
  - `backrankSparse(position)`: Check if either side has <4 pieces on home rank
  - `regionScore(y, white, black)`: Hand-tuned lookup table for 2x2 region mixedness
  - `mixedness(position)`: Sum regionScore over all 49 overlapping 2x2 regions
- Main export `dividePhases(positions)`: Returns PhaseDivision with middlePly, endPly, totalPlies

### Step 4: Confirmed Test Success (GREEN)
Command:
```bash
pnpm exec vitest run src/lib/game/phase.test.ts
```

Exit code: `0`

Output:
```
PASS (8) FAIL (0)
```

All 8 tests pass, confirming:
- Material threshold logic (<=10 for midgame, <=6 for endgame)
- Back-rank sparsity detection
- Mixedness calculation with hand-tuned scoring
- Ply boundary detection logic
- Safety net for simultaneous trigger detection
- Correct ply indexing and null handling

### Step 5: Committed Changes
Command:
```bash
git add src/lib/game/phase.ts src/lib/game/phase.test.ts
git commit -m "feat(phase): port lichess's Divider algorithm for opening/middlegame/endgame boundaries"
```

Commit created: `365bf51`

## Implementation Details

### Key Design Decisions
1. **Exact Port**: Copied lichess's algorithm verbatim, including the literal duplication of (3,0) and (4,0) cases in the regionScore table. This preserves exact lichess behavior rather than "fixing" what might appear as a bug.

2. **Thresholds (Unchanged from lichess)**:
   - `MAJORS_MINORS_MIDGAME = 10`: Major/minor piece count to trigger midgame
   - `MAJORS_MINORS_ENDGAME = 6`: Major/minor piece count to trigger endgame
   - `MIXEDNESS_MIDGAME = 150`: Interleaving score threshold for midgame

3. **Ply Boundary Logic**:
   - First ply (index 0) where any trigger fires → `midGame`
   - First ply where material <= 6 and midGame exists → `endGame`
   - `middlePly` nulled if it equals or follows `endPly` (safety net in Scala original)

4. **Position Representation**: 
   - Consumed `Position = Record<Square, Piece>` where `Piece = [PieceType, PieceColor]`
   - Square format: 'e4', 'a1', etc. (lowercase files, numeric ranks 1-8)
   - Piece types: 'K', 'Q', 'R', 'B', 'N', 'P'
   - Colors: 'w' (white), 'b' (black)

### Test Fixtures Verified
All test fixtures use exact piece placements specified in the brief, numerically verified before writing the brief:
- Starting position: Full 32-piece setup
- Sparse (majorsAndMinors=10): 6 white + 4 black major/minors
- Developed (backrankSparse): All rank-1 pieces except king moved to rank-3
- Midgame/Endgame pair: Progressive piece reduction to trigger each threshold
- BothAtOnce (6 major/minors): Simultaneously triggers both thresholds
- Interleaved (mixedness>150): 16 knights in alternating colors on ranks 3-6

## Files Modified
- Created: `src/lib/game/phase.ts` (127 lines)
  - Exports: `PhaseDivision` interface, `dividePhases()` function
  - Imports: `Piece`, `PieceColor`, `Position`, `Square` from `$lib/board/types`

- Created: `src/lib/game/phase.test.ts` (157 lines)
  - Imports: `dividePhases` from `./phase`, vitest, position type from `$lib/board/types`
  - Fixtures: STARTING_POSITION constant with full 32-piece setup

## Deviations from Brief
None. The implementation and tests are exact transcriptions from the brief. No simplifications, no "improvements," no deviations from exact thresholds or scoring tables.

## Concerns
No implementation concerns. All 8 tests pass on first run after implementation. No deviations from specification.

## Post-Implementation Cleanup

### Fix: Remove Unused PieceColor Import
**Commit**: `8a935a8`

Fixed linter error where `PieceColor` was imported but never used in `phase.ts`.

**Change**:
```typescript
// Before
import type { Piece, PieceColor, Position, Square } from '$lib/board/types';

// After
import type { Piece, Position, Square } from '$lib/board/types';
```

**Verification**:
```bash
pnpm exec vitest run src/lib/game/phase.test.ts  # PASS (8) FAIL (0)
pnpm lint                                         # ESLint: No issues found
```

All 8 tests continue to pass; lint cleanup resolves `@typescript-eslint/no-unused-vars` failure.
