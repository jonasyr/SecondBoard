# Task 2 Report: Wire Real `classCodes` into the Store

## Summary

Successfully implemented Task 2 following strict TDD: wrote failing tests first, confirmed they failed, implemented the feature, and confirmed all tests pass. The `AppState` now exposes `classCodes: ClassCode[]` computed from real Chess.com-style analysis via `classifyGame(evalPerPly)`.

## Implementation Details

### Files Modified
- `src/lib/stores/app-state.svelte.ts` — Added `classCodes` to interface, defaultState, startReview reset, and refreshRealAnalysis computation
- `src/lib/stores/app-state.test.ts` — Added 3 new test cases (2 in "real analysis loading" block, 1 expectation in "startReview (real PGN parsing)" block)

### Changes Made

#### app-state.svelte.ts
1. **Imports**: Extended existing imports to include `ClassCode` type and `classifyGame` function
   ```typescript
   import type { Screen, Tab, ClassCode } from '$lib/types';
   import { classifyGame } from '$lib/game/classify';
   ```

2. **AppState Interface**: Added `classCodes` field after `bestMoves`
   ```typescript
   classCodes: ClassCode[];
   ```

3. **defaultState**: Initialized `classCodes` to empty array
   ```typescript
   classCodes: [],
   ```

4. **startReview()**: Reset `classCodes` alongside `evalPerPly` and `bestMoves` when parsing new PGN
   ```typescript
   appState.classCodes = [];
   ```

5. **refreshRealAnalysis()**: Computed real classifications from evalPerPly once analysis loads
   ```typescript
   appState.classCodes = classifyGame(evalPerPly);
   ```

#### app-state.test.ts
1. **Test 1**: "populates classCodes from the real evalPerPly once analysis is ready"
   - Verifies `classCodes` starts empty while loading
   - After analysis resolves with `[0, 1]` evalPerPly, expects `['best']` classification
   
2. **Test 2**: "leaves classCodes empty (not fabricated) when loadRealAnalysis rejects"
   - Verifies `classCodes` remains `[]` when analysis fails (no fabrication)
   
3. **Test 3**: Added expectation in "on successful parse" test
   - Verifies `classCodes` resets to `[]` on every fresh PGN parse, before real analysis lands

## Test Results

### Initial Test Run (Failing)
```
PASS (15) FAIL (3)

1. startReview (real PGN parsing) on successful parse: populates game, resets parseError, and loads the review screen
   AssertionError: expected undefined to deeply equal []
2. real analysis loading populates classCodes from the real evalPerPly once analysis is ready
   AssertionError: expected undefined to deeply equal []
3. real analysis loading leaves classCodes empty (not fabricated) when loadRealAnalysis rejects
   AssertionError: expected undefined to deeply equal []
```
All failures due to `classCodes` property not existing on AppState yet.

### After Implementation (Passing)
```
PASS (18) FAIL (0)
```
All 18 tests pass (15 original + 3 new).

### TypeScript Check
```
pnpm check
1784544079011 COMPLETED 472 FILES 0 ERRORS 14 WARNINGS 6 FILES_WITH_PROBLEMS
```
No new type errors introduced. The 14 warnings are all pre-existing (unrelated a11y and state references in svelte files).

## Commit

```
220df07 feat: populate appState.classCodes from real analysis
```

**Files changed**: 2
- `src/lib/stores/app-state.svelte.ts`
- `src/lib/stores/app-state.test.ts`

**Lines added**: 36
**Lines removed**: 1

## Self-Review

### TDD Compliance
✓ Wrote failing tests first (3 new tests all failed initially with "expected undefined to deeply equal []")
✓ Ran tests to verify failure before implementing
✓ Implemented minimal feature to satisfy all tests
✓ Ran tests to verify pass (all green: PASS 18, FAIL 0)
✓ Committed with exact message from brief

### Code Quality
✓ Followed brief specifications exactly — no deviations from prescribed locations and code
✓ No breaking changes to existing code
✓ TypeScript types fully satisfied (pnpm check passes with 0 errors)
✓ Feature is properly isolated: `classCodes` computation happens only in `refreshRealAnalysis`, reset only during `startReview`
✓ Error handling correct: `classCodes` stays empty on analysis failure (no fabrication of classifications)

### Architectural Alignment
✓ `classCodes` properly initialized to `[]` at all reset points (defaultState, startReview)
✓ Computation uses existing `classifyGame()` from Task 1 without modification
✓ Integration point is correct: real analysis resolution triggers classification, not parsing
✓ Array indexing semantics preserved: index `i` = classification of ply `i + 1` (inherited from classifyGame design)
✓ Store state machine correct: `analysisStatus` governs when classCodes is populated

### Concerns
None. Implementation is straightforward, well-tested, and follows all stated requirements exactly.
