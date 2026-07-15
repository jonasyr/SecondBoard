# Task 5 Report: `diffMove()` — Pure from/to Detector for Slide Animation

## Summary
Successfully implemented `diffMove()`, a pure function that diffs two chess positions and returns the piece movement (from/to) for animation purposes. Handles simple moves, captures, and castling robustly via piece identity matching.

## Implementation

### Files Created
- `src/lib/board/diff-move.ts` — Main implementation
- `src/lib/board/diff-move.test.ts` — Test suite

### Algorithm
The `diffMove` function:
1. Collects all squares that differ between two positions into `froms` (vacated) and `tos` (occupied)
2. Attempts to find an identity match: iterates through `tos` and looks for a `from` whose piece equals the piece at `to` in `cur`
3. If match found, returns the pair
4. Fallback: returns first pair `{ from: froms[0], to: tos[0] }` if no identity match
5. Returns `null` if no froms/tos or positions are identical

Helper function `pieceEquals(a?: Piece, b?: Piece)` compares piece tuples for equality.

### TDD Evidence

#### Step 2: RED (Tests fail before implementation)
```
Error: Failed to resolve import "./diff-move" from "src/lib/board/diff-move.test.ts".
Does the file exist?
```

#### Step 4: GREEN (All tests pass after implementation)
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

All 5 tests pass:
1. ✓ Detects simple pawn push (e2 → e4)
2. ✓ Detects capture robustly (N f3 captures P e5)
3. ✓ Handles castling by piece identity (K e1 → g1 + R h1 → f1)
4. ✓ Returns null when no change
5. ✓ Returns null for empty positions

## Self-Review Findings

### Correctness Checklist
- [x] Identity match logic correctly prioritizes piece matching
- [x] Fallback correctly uses `froms[0]/tos[0]` only when no identity match exists
- [x] Null returned correctly for no-change and empty-position cases
- [x] No type violations (strict TypeScript, no `any`)
- [x] Proper imports from `./types` (Move, Piece, Position)
- [x] No scope creep — only created required files

### Logic Verification
- The `pieceEquals` helper correctly checks both type and color
- The `froms`/`tos` collection handles all squares involved (including captures where captured piece leaves a square)
- The identity-match loop provides robustness for multi-piece transitions (castling)
- Fallback `froms[0]/tos[0]` handles edge cases where no piece identity can be matched

### Code Quality
- Function is pure (no side effects)
- No hardcoded values
- Clear variable names and logic flow
- Single responsibility: diff detection only

## Files Modified
- Created: `src/lib/board/diff-move.ts` (33 lines)
- Created: `src/lib/board/diff-move.test.ts` (37 lines)

## Commit
```
2138301 feat: add diffMove pure from/to detector for the slide animation
```

## Concerns
None. Implementation matches specification exactly, all tests pass, code is clean and focused.
