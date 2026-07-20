# Task 1 Report: `src/lib/game/classify.ts` — Pure EP-Cutoff Classifier

## Implementation Summary

Implemented the deterministic core move classifier using Chess.com's published Expected-Points (EP) cutoff table, replacing mocked classification data. The implementation consists of:

- **`classifyMoveByEpLoss(epLossPoints: number): ClassCode`** — Pure cutoff-table lookup function that maps win% loss to one of six classification bands: `best` (≤0), `excellent` (≤2), `good` (≤5), `inaccuracy` (≤10), `mistake` (≤20), or `blunder` (>20). Negative loss (win% improved) is treated as zero (best).

- **`classifyGame(evalPerPly: number[]): ClassCode[]`** — Classifies all moves in a game from White-POV eval values. For each ply, it:
  1. Converts eval to win% using `winPercentFromEval` from `accuracy.ts`
  2. Determines the mover using `sideToMoveForPly` from `notation.ts`
  3. Calculates EP loss from the mover's perspective (accounting for side-of-board conversion)
  4. Classifies using the cutoff table
  5. Returns one classification per move (index i = ply i+1), or empty array for <2 eval samples

## Files Created

- `src/lib/game/classify.ts` — Implementation (65 lines)
- `src/lib/game/classify.test.ts` — Test suite (81 lines)

## Test Execution

### Step 1: Verify tests fail (before implementation)
```bash
pnpm exec vitest run src/lib/game/classify.test.ts
```
**Result**: FAIL (expected) — Cannot resolve import "./classify"

### Step 2: Verify tests pass (after implementation)
```bash
pnpm exec vitest run src/lib/game/classify.test.ts
```
**Result**: PASS (9) FAIL (0)

### Test Coverage
All 9 tests pass:
- `classifyMoveByEpLoss`: 5 tests covering exact zero, cutoff boundaries, post-cutoff transitions, large losses, and negative loss handling
- `classifyGame`: 4 tests covering move classification sequences, blunder detection, empty array for insufficient data, and mover-side attribution (White vs Black POV)

## Commit Details

**Hash**: `d2407c5`  
**Message**: `feat: add real Expected-Points move classifier (classify.ts)`  
**Branch**: `feat/reproduce-chesscom`  
**Changed files**: 2 (both new)
```
 src/lib/game/classify.ts      | 65 +++++++++++++++++++++
 src/lib/game/classify.test.ts | 81 +++++++++++++++++++++++++++
 2 files changed, 146 insertions(+)
```

## Self-Review

### TDD Adherence
✅ **Followed TDD exactly**: Tests written first, verified to fail with expected error, implementation added, all tests verified to pass, committed with exact message from brief.

### Code Quality
✅ **Implementation matches brief verbatim**: Both functions are copied exactly as specified, with identical logic and structure.

✅ **Logic correctness**:
- Cutoff thresholds match Chess.com's published values (0.00/0.02/0.05/0.10/0.20 on 0–1 scale, or 0/2/5/10/20 on 0–100 scale)
- Mover-side POV conversion is correct: White's win% is used for White, inverted (100 − white%) for Black
- Empty array for <2 samples prevents fabrication from incomplete data
- Negative loss → best classification is intentional (improvement is never penalized)

✅ **Dependencies**: Correctly imports and uses `winPercentFromEval` and `sideToMoveForPly` from adjacent modules (both already existed, no new dependencies added).

### Scope Correctness
✅ **Core classifier only**: Implements only the 6 deterministic cutoff-table classes (best/excellent/good/inaccuracy/mistake/blunder). Fuzzy Chess.com features (Book/Brilliant/Great/Miss/Forced) explicitly deferred per the brief's scope note and project docs.

### No Concerns
No ambiguities, no missing context, no test failures. Task is complete as specified.
