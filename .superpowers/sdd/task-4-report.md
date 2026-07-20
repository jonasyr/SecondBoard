# Task 4: Pure Material-Sacrifice Detector — Implementation Report

## Summary
Successfully implemented the pure material-sacrifice detector module (`src/lib/game/material.ts`) with accompanying test suite (`src/lib/game/material.test.ts`). All 4 test cases pass (5 assertions total).

## Implementation Details

### Files Created
1. **`src/lib/game/material.test.ts`** (55 lines)
   - 4 test cases across 2 describe blocks
   - All tests follow TDD pattern: written first, confirmed failing, then passing after implementation

2. **`src/lib/game/material.ts`** (34 lines)
   - Two exported functions: `materialForColor` and `isMaterialSacrifice`
   - Pure functions with no side effects
   - Implements simplified, no-SEE material accounting

### Function Signatures

```typescript
export function materialForColor(position: Position, color: PieceColor): number
```
- Sums standard chess piece values (Q=9, R=5, B=3, N=3, P=1, K=0) for one side
- Returns total material value excluding the king

```typescript
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean
```
- Detects whether the mover's own move dropped their material lead by 3+ points
- Compares material differential (mover - opponent) before and after the move
- Returns true only when material swing is -3 or worse (a real sacrifice)
- Threshold is set to 3 points (one minor piece), preventing minor pawn trades from being classified as sacrifices

### Test Results

**Test Output:**
```
PASS (5) FAIL (0)
```

**Test Cases:**
1. ✅ `materialForColor: sums standard piece values for one side, ignoring the king`
   - White queen + rooks + bishop + knight + pawn = 26 points
   - Black only king = 0 points

2. ✅ `materialForColor: returns 0 for a side with no pieces on the board`
   - Black with only king on board = 0 points

3. ✅ `isMaterialSacrifice: is true when the mover gives up a piece worth 3+ points net`
   - White sacrifices knight (3 points) with no compensation = true

4. ✅ `isMaterialSacrifice: is false for an even trade (capturing a piece of equal value)`
   - White bishop takes Black bishop = no sacrifice (trade neutral, differential improves)

5. ✅ `isMaterialSacrifice: is false for a small material swing under the 3-point sacrifice threshold`
   - White pawn takes Black pawn = no sacrifice (only 1 point swing)

## Implementation Correctness

### Algorithm Verification
- **materialForColor**: Iterates object.values, filters by color, sums piece values via reduce
- **isMaterialSacrifice**: Computes differential before and after, checks if swing <= -3
  - Example: Before: White 3pts, Black 0pts (diff +3), After: White 0pts, Black 0pts (diff 0)
  - Swing: 0 - 3 = -3, which triggers sacrifice detection ✓

### Edge Cases Handled
- King value correctly set to 0 (contributes nothing to material)
- Both colors in position object correctly filtered
- Empty positions for a side correctly return 0
- Threshold of 3 correctly distinguishes minor sacrifices from major ones

## Commit Details

**Commit Hash:** `376753a`

**Commit Message:**
```
feat(material): add a pure material-sacrifice detector for Brilliant classification
```

**Files Changed:**
- `src/lib/game/material.ts` (new) — 34 lines
- `src/lib/game/material.test.ts` (new) — 55 lines

**Total Lines Added:** 89

## Notes

- Follows the exact test code and implementation code from the task brief
- Pure functions with no external dependencies or side effects
- Module is ready to be consumed by Task 5's `classify.ts`
- No lookahead or search-extension logic; simplified material accounting only
- Uses standard piece values: P=1, N=3, B=3, R=5, Q=9, K=0
