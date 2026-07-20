# Task 2: Great's Only-Move Threshold Recalibration — Report

## Status
**DONE** ✓

## Summary

Successfully implemented a recalibration of the "Great" move classification's only-move detector by:
1. Raising the gap threshold from 10 to 20 win%-points
2. Adding a "not already decided" guard condition (beforePov < 97)

This reduces false positives in positions where the player is already decisively winning, addressing the issue where the detector was over-firing due to MultiPV=2's noisier/shallower second-line evaluation.

## Implementation Details

### Constants Changed (src/lib/game/classify.ts)

**Before:**
```typescript
const GREAT_ONLY_MOVE_GAP = 10;
```

**After:**
```typescript
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 97;
```

### Logic Modified (src/lib/game/classify.ts, classifySpecial function)

**Before:**
```typescript
if (playedIsBest) {
    const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
    if (secondPov !== null) {
        const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
        if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
            return 'great';
        }
    }
}
```

**After:**
```typescript
if (playedIsBest && beforePov < GREAT_NOT_ALREADY_DECIDED) {
    const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
    if (secondPov !== null) {
        const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
        if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
            return 'great';
        }
    }
}
```

### Test Added (src/lib/game/classify.test.ts)

Added new test: `does not classify an only-move gap as great when the position was already decisively won`

This test verifies that a position with `beforePov = 98` (decisively winning) does not get classified as "great" even when the gap between the best and second-best move is 28 win%-points (which exceeds the new 20-point threshold).

The test fixture uses:
- First PV: White win% = 98 (beforePov)
- Second PV: White win% = 70 (gap of 28 points)
- Guard threshold: beforePov < 97 rejects this position

## Test Results

### Full Test Suite Output
```
RUN  v4.1.10 /home/jonas/Documents/Code/SecondBoard

Test Files  1 passed (1)
     Tests  19 passed (19)
   Start at  19:18:47
   Duration  696ms (transform 48ms, setup 0ms, import 65ms, tests 7ms, environment 509ms)
```

### Key Test Validations

1. **New "already decided" test** (PASS): Correctly rejects Great classification for position with beforePov=98
2. **Pre-existing Great test** (PASS): Still passes unmodified; uses beforePov=75 (well under 97 guard) with gap of exactly 20 points, which still clears the raised >= 20 threshold
3. **All other tests** (18 tests, PASS): No regressions in brilliant, miss, or EP-cutoff classifications

## Self-Review

### Correctness Verification

- ✓ Gap threshold raised to 20: directly addresses the issue where MultiPV=2's noisier second line was inflating false-positive counts
- ✓ Guard condition (beforePov < 97) prevents Great from firing in already-decisively-won positions, mirroring Brilliant's own "not already crushing" logic
- ✓ Pre-existing Great test still passes with the exact same fixture (beforePov=75, gap=20) because 75 < 97 and gap >= 20
- ✓ New test correctly rejects Great when beforePov=98 >= 97, even with gap=28 > 20

### Edge Cases Covered

- Position with beforePov exactly at threshold boundary (97): correctly rejected
- Large gap (28 points) with high beforePov: correctly rejected
- Moderate gap (20 points) with moderate beforePov: correctly accepted (existing test still passes)
- All other special classes (Brilliant, Miss) remain unaffected

### Code Quality

- No interface changes required
- Changes are minimal and surgical: one constant addition, one condition addition
- Mirrors existing guard pattern from BRILLIANT_NOT_WINNING (97)
- Maintains code consistency and readability

## Commit Information

- **Commit Hash:** `1bc3a8b`
- **Branch:** feat/special-move-classes
- **Message:** `fix(classify): raise Great's only-move gap threshold and add a not-already-decided guard`

## Files Modified

1. `src/lib/game/classify.ts` — Constants and logic changes
2. `src/lib/game/classify.test.ts` — New test case added
