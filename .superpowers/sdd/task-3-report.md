# Task 3 Report: TS `api/pgn.ts` — `parsePgn` invoke wrapper

## Summary
Successfully implemented the `parsePgn` Tauri invoke wrapper following the exact specification in the task brief, using TDD methodology (test first, then implementation).

## Implementation Details

### Files Created
1. **src/lib/api/pgn.ts** - Main implementation file
   - Exports `ParsedGame` interface with fields: `sanList`, `positions`, `moves`
   - Exports `parsePgn(pgn: string)` function that invokes the Rust `parse_pgn` command
   - Follows the identical pattern as existing `engine.ts` wrapper

2. **src/lib/api/pgn.test.ts** - Test suite
   - Mocks `@tauri-apps/api/core` using `vi.hoisted()` pattern (mirrors `engine.test.ts`)
   - Tests that `invoke` is called with correct arguments: `'parse_pgn'` command and `{ pgn: string }`
   - Verifies returned `ParsedGame` object structure with `sanList` and `moves` properties

### Files Modified
1. **src/lib/api/index.ts**
   - Added re-export: `export * from './pgn';`
   - Maintains consistency with existing `window` and `engine` re-exports

## Test Results

### Test Execution (RED → GREEN)
1. **Initial test run (RED)** - Failed with expected error:
   ```
   Failed to resolve import "./pgn" from "src/lib/api/pgn.test.ts". Does the file exist?
   ```
   This was the expected failure before implementation.

2. **Final test run (GREEN)** - After implementation:
   ```
   PASS (1) FAIL (0)
   ```
   The single test passes successfully.

## Verification

✅ **Interface Implementation** - `ParsedGame` interface matches specification exactly:
- `sanList: string[]` - Standard Algebraic Notation moves
- `positions: Array<Record<string, [string, string]>>` - Board positions with piece info
- `moves: Array<{ from: string; to: string }>` - Move list

✅ **Function Implementation** - `parsePgn(pgn: string): Promise<ParsedGame>`
- Correctly invokes Tauri command with proper typing
- Returns `Promise<ParsedGame>` as required

✅ **Test Mocking** - Follows established pattern from `engine.test.ts`:
- Uses `vi.hoisted()` for mock creation
- Mocks `@tauri-apps/api/core` module
- Verifies `invoke` call signature

✅ **Index Re-export** - Added to `src/lib/api/index.ts` correctly
- No existing code removed or affected
- Follows existing pattern for `window` and `engine` modules

## Self-Review Findings

- Implementation matches brief specification character-for-character
- No deviations from established patterns (mirrors `engine.ts/engine.test.ts`)
- Test correctly validates both invoke call and result structure
- All files created in correct locations with proper naming
- Re-export added without any issues

## Commit Information

**Commit SHA:** `5401883`
**Commit Message:** `feat: add parsePgn Tauri invoke wrapper`
**Files Changed:** 3 files
- Created: `src/lib/api/pgn.ts`
- Created: `src/lib/api/pgn.test.ts`
- Modified: `src/lib/api/index.ts`

## Dependencies & Integration

This implementation:
- ✅ Consumes: `invoke` from `@tauri-apps/api/core` (already a dependency)
- ✅ Produces: `ParsedGame` interface and `parsePgn` function for Task 4 consumption
- ✅ Integrates cleanly with existing API module structure
- ✅ Ready for Task 4 (game review derivation) to import and use

## Issues or Concerns

None. Task completed successfully per specification.
