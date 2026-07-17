## Task 1 Report: Extract PGN `Result` Tag

### Status: DONE

Successfully implemented extraction of the PGN `Result` tag into the `ParsedGame` struct. The implementation adds a new `result: Option<String>` field and reuses the existing `decode_known_tag()` helper to parse the Result tag value, following the exact pattern used for White/Black/WhiteElo/BlackElo tags.

## Implementation Summary

Modified `src-tauri/src/pgn.rs` to:
- Add `result: Option<String>` field to `ParsedGame` struct (serializes as `result` via serde camelCase)
- Add `result: Option<String>` field to `GameVisitor` struct
- Initialize `result: None` in `GameVisitor::new()`
- Extend `tag()` method to handle `b"Result"` tag using `decode_known_tag(value)`
- Extend `end_game()` to return `result: self.result.take()` in the `ParsedGame`

## TDD Evidence

### RED Phase (Failing Tests)

**Command run:**
```bash
cd src-tauri && cargo test pgn::tests
```

**Expected failure (compile errors before implementation):**
```
error[E0609]: no field `result` on type `ParsedGame`
   --> src\pgn.rs:237:25
    |
237 |         assert_eq!(game.result, Some("0-1".to_string()));
    |                         ^^^^^^ unknown field

error[E0609]: no field `result` on type `ParsedGame`
   --> src\pgn.rs:244:25
    |
244 |         assert_eq!(game.result, None);
    |                         ^^^^^^ unknown field
```

Why expected: Tests reference a field that doesn't exist yet (written before implementation).

### GREEN Phase (Passing Tests)

**Command run after implementation:**
```bash
cd src-tauri && cargo test pgn::tests
```

**Output:**
```
cargo test: 12 passed, 17 filtered out (2 suites, 0.01s)
```

**Verification of specific new tests:**
- `cargo test pgn::tests::extracts_the_result_tag` → 1 passed
- `cargo test pgn::tests::treats_a_missing_result_tag_as_none` → 1 passed

**Full test suite:**
```bash
cargo test
```

**Output:**
```
cargo test: 29 passed (3 suites, 1.01s)
```

## Tests Implemented

### Test 1: `extracts_the_result_tag`
Uses SAMPLE_PGN which contains `[Result "0-1"]`. Verifies extraction of the result value into `game.result == Some("0-1".to_string())`.

### Test 2: `treats_a_missing_result_tag_as_none`
Uses a minimal PGN without a Result tag. Verifies that absence of the tag results in `game.result == None`.

## Files Changed

- `src-tauri/src/pgn.rs` (18 insertions)
  - Added `result: Option<String>` field to `ParsedGame` struct
  - Added `result: Option<String>` field to `GameVisitor` struct
  - Added `result: None` initialization in `GameVisitor::new()`
  - Added `b"Result" => self.result = decode_known_tag(value)` to `tag()` method
  - Added `result: self.result.take()` to `end_game()` method
  - Added two new test functions

## Self-Review

Implementation verified against brief requirements:
- ✓ Field name is `result: Option<String>` (serializes as `result` via serde camelCase)
- ✓ Uses existing `decode_known_tag()` helper (reuses "?" → None logic)
- ✓ Immutable patterns used throughout (`.take()` for Option ownership)
- ✓ Both tests pass individually and in full suite
- ✓ No compiler warnings
- ✓ Test assertions are precise and verify both Some and None cases
- ✓ Code organization unchanged; only additions to existing module

## Concerns

None. Implementation is complete and correct:
- All 29 tests pass (2 new tests + 27 existing)
- Code matches brief specification exactly
- Immutability patterns followed
- Proper use of existing helpers
- Clean build with no warnings

## Commit

**SHA:** `17667f0`  
**Message:** `feat(pgn): extract the Result PGN tag into ParsedGame`
