## Task 1 Report: Rust `pgn` module — core parser

### Status: DONE

Two test-fixture discrepancies were found and escalated mid-task (see below); the coordinator independently verified both, fixed the plan file (commit `897f388`), and supplied corrected test bodies, which have been applied. All 8 tests now pass and the work is committed (`4a32f67`).

### What was implemented

- `src-tauri/Cargo.toml`: added `pgn-reader = "0.28.0"` and `shakmaty = "0.28.0"` (see "Dependency version note" below for why this differs from the brief's `0.27` request).
- `src-tauri/src/pgn.rs`: created with `ParsedGame`, `MoveDto` (with `PartialEq` added to the derive list per the brief's Step 4 note), `GameVisitor` implementing `pgn_reader::Visitor`, `parse_pgn`, and helper functions `role_letter`, `color_letter`, `board_to_position`, `king_castle_destination`, `move_dto` — all transcribed from the brief essentially verbatim.
- `src-tauri/src/lib.rs`: added `mod pgn;` next to the existing `mod engine;`, above `#[cfg_attr(mobile, tauri::mobile_entry_point)]`.

### Dependency version note (resolved without escalating)

`cargo add pgn-reader shakmaty` initially picked `pgn-reader 0.27.0` + `shakmaty 0.27.3`, matching the brief's expected output exactly. However, `pgn-reader 0.27.0`'s own `Cargo.lock` entry depends on `shakmaty 0.28.0` internally — so with our crate also depending on `shakmaty 0.27.3` directly, two different major-incompatible versions of the `shakmaty` crate ended up in the dependency graph, causing `E0308` type mismatches (`shakmaty::Move` from 0.27.3 vs `shakmaty::m::Move` from 0.28.0) at every call site that passed a `shakmaty` type across the `pgn_reader` boundary.

Fix: bumped our direct `Cargo.toml` dependency to `shakmaty = "0.28.0"` (matching what `pgn-reader` actually requires) and re-ran `cargo update -p shakmaty`; this collapsed the graph to a single `shakmaty 0.28.0`, resolving the type mismatch. This is a mechanical fix (aligning our direct dep with pgn-reader's transitive dep), not a design change, so I did not escalate it — flagging it here for visibility since it changes `Cargo.toml` from what the brief's Step 1 literally states.

### `play_unchecked` — which form compiled

**`play_unchecked(m)` — by value, not `&m`.** In shakmaty 0.28.0, `Position::play_unchecked` has signature `fn play_unchecked(&mut self, m: Move)`. The brief's code passed `&m`; I changed it to `m` (moving the owned `Move` in after `move_dto(&m)` had already taken and released its borrow). Also had to change `move_dto`'s internal `match *m { ShakMove::Castle {..} => ... }` to `match m { &ShakMove::Castle {..} => ... }` because `shakmaty::Move` in 0.28.0 is not `Copy`, so dereferencing it in a match (which the brief's code did as `match *m`) fails to compile with "cannot move out of `*m` which is behind a shared reference."

### Tests: RED then partial GREEN

**RED** (`cargo test --lib pgn::`, before Step 4's implementation was pasted in):
```
error[E0425]: cannot find function `parse_pgn` in this scope
  (x5, one per test using it)
```
As expected.

**After implementation, GREEN except 2 of 8 tests:**
```
test result: FAILED. 6 passed; 2 failed; 0 ignored; 0 measured; 10 filtered out
```

Passing (6): `parses_the_full_sample_game_san_list`, `starting_position_is_the_standard_setup`, `after_ply_1_white_pawn_is_on_e4_not_e2`, `white_kingside_castle_moves_both_king_and_rook_and_reports_king_squares`, `black_queenside_castle_also_computes_the_correct_king_destination`, `rejects_a_pgn_with_no_movetext`.

Failing (2) — both appear to be genuine errors in the brief's test *expectations*, not implementation bugs:

**1. `final_position_matches_the_last_move_ne5`**

The brief asserts the final move `16. Ne5` originates from `f6` (i.e. expects `final_pos.get("f6") == None` and `game.moves[30] == MoveDto { from: "f6", to: "e5" }`). I traced the game's knight moves manually and then verified with a throwaway debug test (removed before this report): the actual move is `f3 → e5`, not `f6 → e5`. Tracing the SAN list's knight moves: `Nf3` (g1→f3), `Nbd2` (b1→d2), `Nf1` (the d2 knight relocates to f1, since f3 is occupied by the other knight), `Ng3` (the f1 knight relocates to g3, since g3 isn't reachable from f3), leaving one white knight on f3 the whole game until the final `Ne5`, which can only be reached from f3 (g3→e5 is not a legal knight move). The black knight that reached f6 via move 8 (`8...Nf6`) is never moved again in this game and is still standing on f6 at the end — confirmed by the debug print: `f6: Some(("N", "b"))`, `e5: Some(("N", "w"))`, `f3: None`, `last move: MoveDto { from: "f3", to: "e5" }`.

This looks like the brief's author mentally substituted the black knight's resting square (f6, from an earlier unrelated move) for the actual origin of White's final knight move. My implementation's output (`f3 → e5`) is consistent with straightforward chess reasoning and with shakmaty's own legality checking (an actually-illegal `f6 → e5` would have been rejected).

**2. `rejects_malformed_pgn_with_an_illegal_move`**

PGN used: `"1. e4 e5 2. Qh5 Nf6 3. Qxf9"` (comment: "f9 doesn't exist on a chessboard"). Debug output: `parse_pgn` returns `Ok(ParsedGame { san_list: ["e4", "e5", "Qh5", "Nf6"], ... })` — i.e. `pgn_reader::BufferedReader` simply cannot tokenize `Qxf9` as a SAN move (since rank 9 isn't a valid destination square in the grammar), so it silently stops reading tokens at that point and treats the game as ending after `3...Nf6`, calling `end_game()` on the partial-but-fully-legal game. Our `Visitor::san` callback is never invoked for `Qxf9` at all — there is no illegal-move error surfaced through `SanPlus::san.to_move`, because the SAN parser rejects it before it ever becomes a `SanPlus` value. So `result.is_err()` is false; the test's premise (that this specific PGN exercises the "illegal move" error path in `GameVisitor::san`) does not hold against the real crate's behavior.

The *other* illegal-move path (an actual chess-illegal move that still tokenizes as valid SAN, e.g. a queen ordered to a square it cannot legally reach) would exercise `san_plus.san.to_move(&self.pos)` returning `Err` and correctly produce `parse_pgn` returning `Err(...)` — i.e. the error-handling code itself looks correct; only this specific test fixture doesn't trigger it.

### Why I'm escalating instead of just rewriting the assertions

The task brief explicitly told me to escalate rather than guess when "a test's expected values genuinely seem wrong after you've double-checked your own implementation logic" — and to trust the compiler only for the one flagged `play_unchecked(&m)`-vs-`play_unchecked(m)` ambiguity. Both of the above are substantive corrections to the plan's test fixtures (not implementation guesses), so I stopped short of unilaterally editing the two failing test bodies and left them as-is (still failing) pending guidance on the intended fix:

- For test 1: either correct the assertion to `from: "f3"` / `final_pos.get("f3") == None` (matching real gameplay), or replace the PGN sample if a different final move was intended.
- For test 2: either swap in a PGN whose final move is syntactically valid SAN but chess-illegal (e.g. a queen move to an unreachable square), or accept/document that malformed-square SAN causes `pgn_reader` to silently truncate the game rather than error, and adjust the test's intent accordingly.

### Files changed
- `src-tauri/Cargo.toml` (added `pgn-reader = "0.28.0"`, `shakmaty = "0.28.0"`)
- `src-tauri/Cargo.lock` (regenerated)
- `src-tauri/src/pgn.rs` (new file)
- `src-tauri/src/lib.rs` (added `mod pgn;`)

### No commit created yet

Per the escalation guidance, I have not run Step 6's commit — 6/8 tests are green but 2 are failing pending a decision on the fixtures above. Working tree currently has the implementation in place and both failing tests left untouched (still asserting the brief's original — apparently incorrect — expected values) so the failures are reproducible for review.
