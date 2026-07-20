# Task 3 Report: Compute `secondEvalPerPly`/`secondWdlPerPly` in `engine-analysis.ts`

**Status:** DONE

**Commit Hash:** `65157456223592c9b3b703143891730228fb8ff5`

**Test Summary:** All 11 tests pass (8 existing + 3 new)

---

## Implementation Details

### Changes Made

1. **Updated `RealAnalysis` Interface** (`src/lib/game/engine-analysis.ts`, lines 14-20)
   - Added `secondEvalPerPly: (number | null)[]` property
   - Added `secondWdlPerPly: (Wdl | null)[]` property
   - Both follow the same White-POV conventions as the primary `evalPerPly` and `wdlPerPly`

2. **Implemented `secondEvalPerPly` Computation** (lines 75-77)
   - Maps over `results` array using the index as `ply`
   - Returns `null` when `r.secondEvalCp === null` (no second PV line reported by engine)
   - Uses existing `toWhitePovEval` helper to normalize to White POV
   - Applies side-to-move correction using `sideToMoveForPly(ply)`

3. **Implemented `secondWdlPerPly` Computation** (lines 79-81)
   - Maps over `results` array using the index as `ply`
   - Returns `null` when `r.secondWdl` is falsy
   - Uses existing `toWhitePovWdl` helper to flip wins/losses for Black POV
   - Applies side-to-move correction using `sideToMoveForPly(ply)`

4. **Updated Return Statement** (line 91)
   - Added `secondEvalPerPly` and `secondWdlPerPly` to the returned object

### Code Pattern

The implementation mirrors the exact same pattern used for primary eval/WDL:
- **evalPerPly** → **secondEvalPerPly** (same POV-flip logic)
- **wdlPerPly** → **secondWdlPerPly** (same POV-flip logic)

Per-ply indexing and array lengths are identical, enabling direct parallel consumption in downstream code.

---

## Tests Added

Three new tests were added to `src/lib/game/engine-analysis.test.ts` (lines 133-184):

### Test 1: `produces one secondEvalPerPly entry per position, normalized to White POV`
- Mocks engine to return `secondEvalCp: 20` consistently
- Verifies array length matches input positions
- Confirms ply 0 (White to move): `+20cp → +0.20 White POV`
- Confirms ply 1 (Black to move): `+20cp for Black → -0.20 White POV`

### Test 2: `reports a null secondEvalPerPly entry when the engine reported no second PV line`
- Mocks engine to return `secondEvalCp: null`
- Verifies all entries in `secondEvalPerPly` are `null`

### Test 3: `produces one secondWdlPerPly entry per position, flipped to White POV`
- Mocks engine to return `secondWdl: [600, 300, 100]` consistently
- Confirms ply 0 (White to move): `[600, 300, 100]` (no flip)
- Confirms ply 1 (Black to move): `[100, 300, 600]` (w/l swap to White POV)

---

## Test Results

### Before Implementation
```
 Test Files  1 failed (1)
      Tests  3 failed | 8 passed (11)
```

All three new tests failed as expected with `undefined` properties.

### After Implementation
```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

All 11 tests pass:
- 8 existing tests (unchanged)
- 3 new tests (all passing)

---

## Self-Review

### Correctness
✓ Null-checks are correct: `r.secondEvalCp === null` for eval, `r.secondWdl ? ...` for WDL
✓ POV-flip logic reuses existing, tested helpers
✓ Array indexing and ply calculations are consistent with primary eval arrays
✓ No edge cases missed: final-ply handling inherits from existing patterns

### Consistency
✓ Naming convention follows primary arrays (`secondEvalPerPly` mirrors `evalPerPly`)
✓ Return object structure maintains alphabetical grouping with related fields
✓ Code style matches surrounding implementation

### Interface Compatibility
✓ `RealAnalysis` interface change is backward-compatible at the module level (consumers of the interface are internal to this file)
✓ New properties can be integrated into consuming code (e.g., UI render layers) without disruption

### Test Coverage
✓ Tests cover happy path (values present), null case, and POV-flip correctness
✓ Tests are isolated with per-test mocking using `beforeEach`
✓ No brittle assertions; uses appropriate matchers (`toBeCloseTo`, `toEqual`, `every`)

---

## Notes

- No breaking changes; only additive to the `RealAnalysis` interface
- Implementation is minimal and delegates to existing, well-tested helper functions
- All tests run in isolation; no dependency on external state
- Ready for downstream integration with UI/display layers that need to render second-line evals
- Follows TDD: wrote failing tests first, then implemented, then verified green
