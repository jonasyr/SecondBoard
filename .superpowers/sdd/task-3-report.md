# Task 3 Report: `src/lib/game/accuracy.ts` — win%, per-move accuracy, game accuracy, winner

## Implementation Summary

Implemented a pure-function module for computing real per-side game accuracy from Stockfish evaluations and resolving PGN `Result` tags to winner strings. The module replaces mock accuracy fixtures with actual computed values using the public lichess/chess.com-style sigmoid approximation.

**Files created:**
- `src/lib/game/accuracy.ts` (76 lines)
- `src/lib/game/accuracy.test.ts` (65 lines)

**Exported functions:**
1. `winPercentFromEval(evalPawns: number): number` — Maps White-POV eval in pawns to win% (0-100)
2. `computeGameAccuracy(evalPerPly: number[]): GameAccuracy` — Derives per-side accuracy from eval sequence
3. `resolveWinner(result: string | null): Winner` — Parses PGN Result tag to winner

## TDD Evidence

### RED Phase
Test file created and run before implementation:
```bash
$ pnpm exec vitest run src/lib/game/accuracy.test.ts
Failed to resolve import "./accuracy" from "src/lib/game/accuracy.test.ts". Does the file exist?
```
✓ Confirmed: Tests fail with module-not-found error

### GREEN Phase
After implementation:
```bash
$ pnpm exec vitest run src/lib/game/accuracy.test.ts
PASS (10) FAIL (0)
```
✓ Confirmed: All 10 test cases pass

**Test coverage breakdown:**
- `winPercentFromEval`: 5 tests (boundary, symmetry, monotonicity, saturation, spec value)
- `computeGameAccuracy`: 3 tests (insufficient data, perfect play, accuracy averaging)
- `resolveWinner`: 2 tests (standard PGN tags, edge cases)

## Code Quality Self-Review

✓ **Constants exactly as specified:**
  - `winPercentFromEval`: sigmoid constant `-0.00368208` ✓
  - `moveAccuracy`: coefficients `103.1668`, `-0.04354`, `-3.1669` ✓

✓ **Module-level comment:** Clearly states this is a public approximation (not chess.com's proprietary algorithm), with reference to design doc

✓ **Function signatures match spec exactly:**
  - `winPercentFromEval(evalPawns: number): number` ✓
  - `computeGameAccuracy(evalPerPly: number[]): GameAccuracy` ✓
  - `resolveWinner(result: string | null): Winner` ✓

✓ **Immutability:** No mutations; pure functions throughout

✓ **Error handling:** Null returns for insufficient data; clamping in moveAccuracy

✓ **Test assertions:** All numeric values match expected spec output
  - winPercentFromEval(1) = 59.102589719161294 ✓
  - computeGameAccuracy([0, 1, 0.5]) → white/black ≈ 99.9999 ✓
  - computeGameAccuracy([0, -3, -3.2, -8, -8.5]) → white ≈ 37.126083891942, black ≈ 99.9999 ✓

✓ **Test output:** Pristine; no warnings or errors

## Files Changed

```
A  src/lib/game/accuracy.ts
A  src/lib/game/accuracy.test.ts
```

## Commit

- **SHA:** `cb5ccea`
- **Message:** `feat: add real win%-based game accuracy and winner resolution`

## Concerns

None. All test cases pass with exact numeric assertions. Code is self-contained, has no external dependencies beyond the two existing imports (`PieceColor` and `sideToMoveForPly`). Module documentation clearly disclaims this as an approximation per design constraints.

## Next Steps

Task 4 will wire `computeGameAccuracy()` and `resolveWinner()` output into the UI to display real accuracy and game result (currently hardcoded/mocked).
