# Iteration 6 — PGN Parse (shakmaty) + Move Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/lib/game/mock-engine.ts` (the mock JS SAN→position engine, explicitly flagged "must not ship" per LOGIC.md) with a real Rust `pgn` module that parses arbitrary PGN text via `shakmaty`/`pgn-reader`, producing real per-ply board positions, move metadata, and SAN move list — wired end-to-end so "Start Review" (and a genuinely pasted/typed PGN) drives real move navigation instead of a hardcoded mock game.

**Architecture:** A dependency-light Rust `pgn` module (`pgn-reader` for PGN tokenizing, `shakmaty` for chess rules/position tracking) exposes a single Tauri command `parse_pgn(pgn) -> Result<ParsedGame, String>`. The frontend gains an `api/pgn.ts` invoke wrapper, and `appState` gains a `game: GameData | null` field populated by an async `startReview()` that calls the real parser instead of always loading a fixed mock game. `review.ts`'s `getReviewPly`/`getPlayerRows` read positions/moves from this dynamic `game` object. Move classification/coach text/breakdown/phase/player-name display remain mocked (existing `CLASS_CODES`/`COACH_TEXT_MAP`/etc. in `mock-data.ts`), applied only when the loaded game is verified byte-identical to the one known sample PGN — a genuinely different real pasted game shows real positions/moves with no (rather than misleading) classification.

**Tech Stack:** Rust (`pgn-reader` 0.27.0, `shakmaty` 0.27.3 — no MSRV bump needed, both resolve cleanly against this repo's existing `rust-version = "1.77.2"`), Tauri v2 commands, SvelteKit + Svelte 5 (runes), TypeScript strict, Vitest, Cargo's built-in test harness.

## Global Constraints

- **Scope boundary — this iteration replaces position/move generation ONLY.** It does NOT add: SQLite persistence (a later iteration), real move classification from centipawn-loss thresholds (OVERVIEW §11's formulas — a later iteration; classification stays mocked), opening/ECO detection, Chess.com sync, or real player names/ratings/event/date wired into the UI. `PlayerRow`/`AccuracyBlock`/`DetailsTab` keep showing the existing mocked `PLAYERS`/detail strings unchanged — this is a deliberate, documented deferral, not a bug or oversight to "fix."
- **No new Rust dependencies beyond `pgn-reader` and `shakmaty`, both at the versions `cargo add` naturally resolves against this repo's existing `rust-version = "1.77.2"`** — `pgn-reader = "0.27.0"`, and `shakmaty = "0.28.0"` (NOT `0.27.3`: `cargo add` initially picks `0.27.3` for our own direct dependency, but `pgn-reader 0.27.0` transitively requires `shakmaty 0.28.0`, so our own `Cargo.toml` entry must be bumped to `0.28.0` to collapse the graph to one version — see Task 1 Step 1). Do not bump `rust-version`, do not pull in a newer major of either crate beyond what this resolves to.
- **`mock-engine.ts` and `mock-engine.test.ts` are deleted entirely** (LOGIC.md's explicit "must not ship" mock; README §1: "A tiny SAN → board-position engine... Replace with real move data from the Rust `pgn` module").
- **`mock-data.ts`'s `CLASS_CODES`/`COACH_TEXT_MAP`/`BREAKDOWN_ROWS`/`PHASE_ROWS`/`PLAYERS`/`EVAL_PER_PLY`/`BEST_MOVES` are KEPT, not deleted** — they remain legitimate mock content describing the one known built-in sample game, and are applied only when the currently-loaded game is verified byte-identical (`isSample: true`) to the known sample PGN text. `SAN_LIST`, `MOCK_POSITIONS`, `MOCK_MOVE_META` (built from `mock-engine.ts`'s `buildGame`) ARE removed from `mock-data.ts` since real per-game data now supersedes them.
- **Castling gotcha (binding on Task 1):** shakmaty's `Move::Castle { king, rook }` fields are both ORIGIN squares; `Move::to()` for a castle returns the ROOK's square, NOT the king's destination. The king's actual destination must be computed manually (g-file same rank if kingside — rook's file > king's file — else c-file). `MoveDto.from`/`to` for castling must be the KING's origin/destination (matching the existing, soon-deleted `mock-engine.ts`'s own convention verbatim — its `applySan`'s `O-O` case returns `{from:'e'+rank,to:'g'+rank}`, and the frontend's last-move highlight/coach-text only ever show the king's two squares for a castle, never the rook's).
- **`shakmaty::Position::play_unchecked` in 0.28.0 takes `Move` BY VALUE** (`fn play_unchecked(&mut self, m: Move)`), not `&Move` — and `shakmaty::Move` is not `Copy` in this version, so a `match *m { ... }` pattern (dereferencing a `&Move`) will not compile; match on the reference directly instead (see Task 1's `move_dto` for the exact pattern). If a future crate update changes either of these, trust the compiler's error over this plan's prose.
- **Serde boundary is camelCase**, matching every prior iteration's Rust↔TS contract (`#[serde(rename_all = "camelCase")]`).
- **`getReviewPly`'s new `game: GameData` parameter is REQUIRED (no default)** — a deliberate signature-breaking change (unlike `evalPerPly`/`bestMoves`, which keep optional defaults), since there is no more static mock position data to fall back to. Every call site (components + tests) is updated in the same task that changes the signature.
- **Svelte 5 runes only** (`$state`, `$derived`, `$props`, `$effect`); TypeScript strict mode; no `any`. A plain exported function (not a rune) is used for `getMaxPly()` — Svelte 5 does not support exporting a live-recomputing primitive `$derived` binding for cross-module reassignment purposes; a function reading the reactive `appState` singleton on each call is the correct, simple pattern here (every call site invokes it inside an event handler or another function, never renders it directly as reactive template text).
- **Reuse existing tokens/CSS custom properties for the new onboarding error banner** — no new hardcoded hex values.
- **Ledger discipline:** append one line to `.superpowers/sdd/progress.md` under a new `Iteration 6 (PGN parse via shakmaty + move navigation):` heading after each task's review passes, matching the terse style of prior iterations' entries. Never rewrite prior entries.
- **This repo uses `pnpm`, not `npm`**, for all JS/TS commands.

---

## Task 1: Rust `pgn` module — core parser (types, Visitor, `parse_pgn`)

**Files:**
- Modify: `src-tauri/Cargo.toml` (add `pgn-reader = "0.27.0"` and `shakmaty = "0.28.0"` — see Global Constraints on why `shakmaty` is `0.28.0`, not the `0.27.3` `cargo add` initially suggests)
- Create: `src-tauri/src/pgn.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod pgn;` near the top, above `#[cfg_attr(mobile, tauri::mobile_entry_point)]`)

**Interfaces:**
- Produces (used by Task 2): `pub fn parse_pgn(pgn: &str) -> Result<ParsedGame, String>` where
  ```rust
  #[derive(Debug, Clone, serde::Serialize)]
  #[serde(rename_all = "camelCase")]
  pub struct ParsedGame {
      pub san_list: Vec<String>,
      pub positions: Vec<std::collections::HashMap<String, (String, String)>>,
      pub moves: Vec<MoveDto>,
  }

  #[derive(Debug, Clone, serde::Serialize)]
  pub struct MoveDto {
      pub from: String,
      pub to: String,
  }
  ```
  `positions.len() == san_list.len() + 1` (includes the starting position at index 0). `moves.len() == san_list.len()`; `moves[i]` is the move that produces `positions[i+1]` from `positions[i]`. Each position map's values are `(pieceTypeLetter, colorLetter)` — role letters `P`/`N`/`B`/`R`/`Q`/`K` (uppercase), color letters `w`/`b` — serializing to a 2-element JSON array via serde_json's default tuple handling, matching the frontend's `Piece = [PieceType, PieceColor]` tuple type (`src/lib/board/types.ts`) exactly.

- [ ] **Step 1: Add the two new dependencies**

Run: `cd src-tauri && cargo add pgn-reader shakmaty`
Expected output includes:
```
      Adding pgn-reader v0.27.0 to dependencies
      Adding shakmaty v0.27.3 to dependencies
```

`cargo add` picks `shakmaty v0.27.3` for our own direct dependency, but `pgn-reader v0.27.0` itself transitively depends on `shakmaty v0.28.0` — two different major-incompatible `shakmaty` versions in the graph causes real type mismatches (`shakmaty::Move` from one version isn't the same type as from the other) at every point this module passes a shakmaty type across the `pgn_reader` boundary. Fix it immediately: edit `Cargo.toml` so our own `shakmaty` entry reads `shakmaty = "0.28.0"` (matching what `pgn-reader` actually needs), then run `cargo update -p shakmaty` to collapse the graph to a single version. Confirm with `cargo tree -i shakmaty` — it should show exactly one `shakmaty v0.28.0` used by both our crate and `pgn-reader`, not two versions.

- [ ] **Step 2: Write the failing tests**

Create `src-tauri/src/pgn.rs` with just the test module first (the real implementation comes in Step 4):

```rust
//! Parses PGN move text into real per-ply board positions (OVERVIEW §6.5/§8.3
//! `pgn` module). Replaces `src/lib/game/mock-engine.ts` — the JS mock LOGIC.md
//! explicitly says must not ship. Only the mainline is parsed (RAV variations
//! are skipped); no tag/metadata extraction this iteration (README §11 step 6
//! scope — see the plan's Global Constraints).

use std::collections::HashMap;

use pgn_reader::{BufferedReader, SanPlus, Skip, Visitor};
use shakmaty::{Chess, Color, Move as ShakMove, Position, Role, Square};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedGame {
    pub san_list: Vec<String>,
    pub positions: Vec<HashMap<String, (String, String)>>,
    pub moves: Vec<MoveDto>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MoveDto {
    pub from: String,
    pub to: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_PGN: &str = concat!(
        "[Event \"Live Rapid\"]\n",
        "[Site \"Chess.com\"]\n",
        "[White \"Jonas\"]\n",
        "[Black \"DominikP\"]\n",
        "[Result \"0-1\"]\n",
        "[WhiteElo \"1867\"]\n",
        "[BlackElo \"2043\"]\n",
        "[TimeControl \"600\"]\n",
        "\n",
        "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n",
        "7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n",
        "12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5"
    );

    const SAMPLE_SAN_LIST: [&str; 31] = [
        "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6", "O-O", "O-O", "Re1", "a6",
        "Bb3", "Ba7", "h3", "h6", "Nbd2", "Be6", "Bxe6", "fxe6", "Nf1", "Qe7", "Ng3", "Rad8", "d4",
        "exd4", "cxd4", "d5", "Ne5",
    ];

    #[test]
    fn parses_the_full_sample_game_san_list() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        assert_eq!(game.san_list, SAMPLE_SAN_LIST.to_vec());
        assert_eq!(game.positions.len(), 32);
        assert_eq!(game.moves.len(), 31);
    }

    #[test]
    fn starting_position_is_the_standard_setup() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        let start = &game.positions[0];
        assert_eq!(start.get("e2"), Some(&("P".to_string(), "w".to_string())));
        assert_eq!(start.get("e1"), Some(&("K".to_string(), "w".to_string())));
        assert_eq!(start.get("e8"), Some(&("K".to_string(), "b".to_string())));
        assert_eq!(start.len(), 32);
    }

    #[test]
    fn after_ply_1_white_pawn_is_on_e4_not_e2() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        let after_e4 = &game.positions[1];
        assert_eq!(after_e4.get("e4"), Some(&("P".to_string(), "w".to_string())));
        assert_eq!(after_e4.get("e2"), None);
        assert_eq!(game.moves[0], MoveDto { from: "e2".to_string(), to: "e4".to_string() });
    }

    #[test]
    fn white_kingside_castle_moves_both_king_and_rook_and_reports_king_squares() {
        // Ply 11 (0-indexed 10) is white's 6.O-O.
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        let after_castle = &game.positions[11];
        assert_eq!(after_castle.get("g1"), Some(&("K".to_string(), "w".to_string())));
        assert_eq!(after_castle.get("f1"), Some(&("R".to_string(), "w".to_string())));
        assert_eq!(after_castle.get("e1"), None);
        assert_eq!(after_castle.get("h1"), None);
        assert_eq!(game.moves[10], MoveDto { from: "e1".to_string(), to: "g1".to_string() });
    }

    #[test]
    fn final_position_matches_the_last_move_ne5() {
        // 16.Ne5 is played by the knight that's been on f3 since move 3 (Nf3);
        // the OTHER white knight took b1->d2->f1->g3 and cannot reach e5 in one
        // move (g3->e5 is not a valid knight move). The black knight from
        // 8...Nf6 never moves again and is still on f6 at the end — a
        // different, unrelated piece.
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        let final_pos = &game.positions[31];
        assert_eq!(final_pos.get("e5"), Some(&("N".to_string(), "w".to_string())));
        assert_eq!(final_pos.get("f3"), None);
        assert_eq!(final_pos.get("f6"), Some(&("N".to_string(), "b".to_string())));
        assert_eq!(game.moves[30], MoveDto { from: "f3".to_string(), to: "e5".to_string() });
    }

    #[test]
    fn black_queenside_castle_also_computes_the_correct_king_destination() {
        // A short synthetic game exercising O-O-O (not present in the sample game),
        // mirroring mock-engine.test.ts's existing castling coverage.
        let pgn = "1. d4 d5 2. Nc3 Nc6 3. Bf4 Bf5 4. Qd2 Qd7 5. O-O-O O-O-O";
        let game = parse_pgn(pgn).expect("synthetic castling PGN should parse");
        let final_pos = game.positions.last().unwrap();
        assert_eq!(final_pos.get("c1"), Some(&("K".to_string(), "w".to_string())));
        assert_eq!(final_pos.get("d1"), Some(&("R".to_string(), "w".to_string())));
        assert_eq!(final_pos.get("c8"), Some(&("K".to_string(), "b".to_string())));
        assert_eq!(final_pos.get("d8"), Some(&("R".to_string(), "b".to_string())));
        let last_move = game.moves.last().unwrap();
        assert_eq!(last_move, &MoveDto { from: "e8".to_string(), to: "c8".to_string() });
    }

    #[test]
    fn rejects_a_pgn_with_no_movetext() {
        let result = parse_pgn("[Event \"Empty\"]\n\n");
        // An empty movetext is not necessarily an error in pgn-reader itself,
        // but a game with zero plies is not useful to this app — assert on
        // whatever parse_pgn actually decides (see Step 4's implementation
        // note): either an explicit error, or an Ok with empty san_list/moves
        // and a single starting position. This test documents the real,
        // observed behavior once Step 4 is implemented — update the assertion
        // to match rather than leaving this test broken.
        match result {
            Ok(game) => {
                assert!(game.san_list.is_empty());
                assert_eq!(game.positions.len(), 1);
            }
            Err(_) => {}
        }
    }

    #[test]
    fn rejects_malformed_pgn_with_an_illegal_move() {
        // Kd8 is syntactically valid SAN (a real square, "K" is a real piece
        // letter) but chess-illegal here: Black's own queen still sits on d8
        // (never moved), so the king cannot move onto it. A syntactically
        // invalid square (e.g. rank 9) would never reach our Visitor's `san`
        // callback at all — pgn-reader's tokenizer rejects it before that,
        // silently truncating the game instead of erroring — so this test
        // must use a move that tokenizes fine but fails shakmaty's legality
        // check, to actually exercise `parse_pgn`'s error path.
        let pgn = "1. e4 e5 2. Ke2 Ke7 3. Kf3 Kd8";
        let result = parse_pgn(pgn);
        assert!(result.is_err(), "an illegal move should produce an error, not a panic");
    }
}
```

- [ ] **Step 3: Run tests to verify they fail (compile error — `parse_pgn` doesn't exist yet)**

Run: `cd src-tauri && cargo test --lib pgn:: 2>&1 | tail -30`
Expected: FAIL — `error[E0425]: cannot find function \`parse_pgn\` in this scope` (and similar for `MoveDto`'s derive if incomplete).

- [ ] **Step 4: Implement the Visitor and `parse_pgn`**

Insert into `src-tauri/src/pgn.rs`, above the `#[cfg(test)]` module:

```rust
fn role_letter(role: Role) -> &'static str {
    match role {
        Role::Pawn => "P",
        Role::Knight => "N",
        Role::Bishop => "B",
        Role::Rook => "R",
        Role::Queen => "Q",
        Role::King => "K",
    }
}

fn color_letter(color: Color) -> &'static str {
    match color {
        Color::White => "w",
        Color::Black => "b",
    }
}

fn board_to_position(pos: &Chess) -> HashMap<String, (String, String)> {
    let mut map = HashMap::new();
    for (square, piece) in pos.board().iter() {
        map.insert(
            square.to_string(),
            (role_letter(piece.role).to_string(), color_letter(piece.color).to_string()),
        );
    }
    map
}

/// shakmaty's `Move::Castle { king, rook }` gives the ORIGIN squares of both
/// pieces; `Move::to()` returns the rook's square, NOT the king's destination
/// (see this crate's own doc comment on `Move::to`). Standard chess rule: the
/// king lands on the g-file if castling kingside (rook's file is to the right
/// of the king's), otherwise the c-file; always the same rank as the king's
/// origin square.
fn king_castle_destination(king_from: Square, rook_from: Square) -> Square {
    let kingside = rook_from.file() > king_from.file();
    let file = if kingside { shakmaty::File::G } else { shakmaty::File::C };
    Square::from_coords(file, king_from.rank())
}

/// Reduces any legal shakmaty `Move` to the simple (from, to) pair the
/// frontend needs for its last-move highlight and coach-text move label.
/// Castling reports the KING's origin/destination (matching the deleted
/// mock-engine.ts's own convention) rather than the rook's.
fn move_dto(m: &ShakMove) -> MoveDto {
    // NOTE: `shakmaty::Move` is not `Copy` in 0.28.0, so `match *m { ... }`
    // (moving out of a shared reference) will not compile — match on `m`
    // directly instead (matching a reference binds by reference).
    match m {
        &ShakMove::Castle { king, rook } => MoveDto {
            from: king.to_string(),
            to: king_castle_destination(king, rook).to_string(),
        },
        other => MoveDto {
            from: other.from().unwrap_or_else(|| other.to()).to_string(),
            to: other.to().to_string(),
        },
    }
}

struct GameVisitor {
    pos: Chess,
    san_list: Vec<String>,
    positions: Vec<HashMap<String, (String, String)>>,
    moves: Vec<MoveDto>,
    error: Option<String>,
}

impl GameVisitor {
    fn new() -> Self {
        let pos = Chess::default();
        GameVisitor {
            positions: vec![board_to_position(&pos)],
            pos,
            san_list: Vec::new(),
            moves: Vec::new(),
            error: None,
        }
    }
}

impl Visitor for GameVisitor {
    type Result = Result<ParsedGame, String>;

    fn begin_variation(&mut self) -> Skip {
        Skip(true) // stay in the mainline only; do not descend into RAV variations
    }

    fn san(&mut self, san_plus: SanPlus) {
        if self.error.is_some() {
            return;
        }
        let m = match san_plus.san.to_move(&self.pos) {
            Ok(m) => m,
            Err(err) => {
                self.error = Some(format!("illegal move '{san_plus}': {err}"));
                return;
            }
        };
        self.san_list.push(san_plus.to_string());
        self.moves.push(move_dto(&m));
        // shakmaty 0.28.0's Position::play_unchecked takes Move BY VALUE
        // (not &Move) — pass `m` directly (move_dto already took its &m
        // borrow above and that borrow has ended by this point).
        self.pos.play_unchecked(m);
        self.positions.push(board_to_position(&self.pos));
    }

    fn end_game(&mut self) -> Self::Result {
        if let Some(err) = self.error.take() {
            return Err(err);
        }
        Ok(ParsedGame {
            san_list: std::mem::take(&mut self.san_list),
            positions: std::mem::take(&mut self.positions),
            moves: std::mem::take(&mut self.moves),
        })
    }
}

pub fn parse_pgn(pgn: &str) -> Result<ParsedGame, String> {
    let mut reader = BufferedReader::new(pgn.as_bytes());
    let mut visitor = GameVisitor::new();
    match reader.read_game(&mut visitor) {
        Ok(Some(result)) => result,
        Ok(None) => Err("no game found in PGN text".to_string()),
        Err(err) => Err(format!("failed to read PGN: {err}")),
    }
}
```

Add `mod pgn;` to `src-tauri/src/lib.rs`, placed just above `#[cfg_attr(mobile, tauri::mobile_entry_point)]` (alongside the existing `mod engine;` from Iteration 5).

Also add `#[derive(PartialEq)]` to `MoveDto`'s derive list (needed for the `assert_eq!(game.moves[0], MoveDto {...})`-style test assertions above) — the final derive line should read:
```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct MoveDto {
    pub from: String,
    pub to: String,
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib pgn:: 2>&1 | tail -40`
Expected: `test result: ok. 8 passed; 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/pgn.rs src-tauri/src/lib.rs
git commit -m "feat: add real PGN parsing via shakmaty, replacing the mock SAN engine"
```

---

## Task 2: Rust Tauri command `parse_pgn`

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `pgn::parse_pgn`, `pgn::ParsedGame` (Task 1).
- Produces (used by Task 3): Tauri command `parse_pgn(pgn: String) -> Result<pgn::ParsedGame, String>`, invokable from JS as `invoke('parse_pgn', { pgn })`, returning camelCase JSON `{ sanList: string[], positions: Array<Record<string, [string,string]>>, moves: Array<{from:string,to:string}> }`.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `src-tauri/src/lib.rs` (in a new test module, alongside the existing `analyze_fen_tests` module from Iteration 5):

```rust
#[cfg(test)]
mod parse_pgn_tests {
    use super::*;

    #[test]
    fn parse_pgn_command_delegates_to_the_pgn_module() {
        let pgn = "1. e4 e5 2. Nf3 Nc6".to_string();
        let result = parse_pgn(pgn).expect("valid PGN should parse successfully");
        assert_eq!(result.san_list, vec!["e4", "e5", "Nf3", "Nc6"]);
        assert_eq!(result.positions.len(), 5);
    }

    #[test]
    fn parse_pgn_command_surfaces_parse_errors_as_strings() {
        let bad_pgn = "1. e4 e5 2. Qh5 Nf6 3. Qxf9".to_string();
        let result = parse_pgn(bad_pgn);
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib parse_pgn 2>&1 | tail -30`
Expected: FAIL — `cannot find function \`parse_pgn\` in this scope` (the plain top-level function doesn't exist in `lib.rs` yet — only `pgn::parse_pgn` does).

- [ ] **Step 3: Implement the command**

In `src-tauri/src/lib.rs`, add near the existing `analyze_fen` command:

```rust
#[tauri::command]
fn parse_pgn(pgn: String) -> Result<pgn::ParsedGame, String> {
    pgn::parse_pgn(&pgn)
}
```

Update the `run()` function's `invoke_handler` to also register it:

```rust
        .invoke_handler(tauri::generate_handler![analyze_fen, parse_pgn])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test 2>&1 | tail -50`
Expected: all tests pass, including both new `parse_pgn_tests`.

Also run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: expose parse_pgn as a Tauri command"
```

---

## Task 3: TS `api/pgn.ts` — `parsePgn` invoke wrapper

**Files:**
- Modify: `src/lib/api/index.ts` (add the re-export)
- Create: `src/lib/api/pgn.ts`
- Test: `src/lib/api/pgn.test.ts`

**Interfaces:**
- Consumes: `invoke` from `@tauri-apps/api/core` (already a dependency, already used by `api/engine.ts` in Iteration 5).
- Produces (used by Task 4): 
  ```ts
  export interface ParsedGame {
      sanList: string[];
      positions: Array<Record<string, [string, string]>>;
      moves: Array<{ from: string; to: string }>;
  }
  export function parsePgn(pgn: string): Promise<ParsedGame>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/pgn.test.ts` (mirrors `src/lib/api/engine.test.ts`'s mocking convention exactly):

```ts
import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { parsePgn } from './pgn';

describe('parsePgn', () => {
	it('invokes the parse_pgn command with the given PGN text and returns its result', async () => {
		invoke.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{ e2: ['P', 'w'] }, { e4: ['P', 'w'] }],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		const result = await parsePgn('1. e4 e5');

		expect(invoke).toHaveBeenCalledWith('parse_pgn', { pgn: '1. e4 e5' });
		expect(result.sanList).toEqual(['e4', 'e5']);
		expect(result.moves).toEqual([{ from: 'e2', to: 'e4' }]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/pgn.test.ts`
Expected: FAIL — cannot resolve `./pgn`.

- [ ] **Step 3: Implement `api/pgn.ts`**

Create `src/lib/api/pgn.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export interface ParsedGame {
	sanList: string[];
	positions: Array<Record<string, [string, string]>>;
	moves: Array<{ from: string; to: string }>;
}

/** Invokes the Rust `parse_pgn` Tauri command (LOGIC.md §7/§8; replaces the mock SAN engine). */
export function parsePgn(pgn: string): Promise<ParsedGame> {
	return invoke<ParsedGame>('parse_pgn', { pgn });
}
```

Update `src/lib/api/index.ts` to add the re-export (check the file's current contents first — it should already re-export `window` and `engine`; only add what's missing):

```ts
export * from './pgn';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/api/pgn.test.ts`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/pgn.ts src/lib/api/pgn.test.ts src/lib/api/index.ts
git commit -m "feat: add parsePgn Tauri invoke wrapper"
```

---

## Task 4: `appState` — real PGN loading, `game` field, `getMaxPly`

**Files:**
- Create: `src/lib/game/sample-pgn.ts`
- Modify: `src/lib/components/OnboardingScreen.svelte`
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `parsePgn` from `$lib/api/pgn` (Task 3).
- Produces (used by Task 5 and by components): a `GameData` interface DEFINED IN THIS TASK, locally inside `app-state.svelte.ts` (shape: `{ sanList: string[]; positions: Position[]; moveMeta: Move[]; isSample: boolean }`) — Task 5 moves this definition into `review.ts` and updates this file's import accordingly (`review.ts` doesn't exist with this shape yet at this point in the plan, so defining it here first and relocating it in Task 5 avoids a forward reference). Also produces: `AppState.game: GameData | null`, `AppState.parseError: string | null`, `export function getMaxPly(): number`.

- [ ] **Step 1: Extract the sample PGN into a shared file**

Create `src/lib/game/sample-pgn.ts`:

```ts
/** The one built-in sample game (Italian Game) — the only PGN with matching
 * mock classification/coach-text/breakdown data in mock-data.ts. Shared
 * between OnboardingScreen.svelte (the "Paste sample game" button) and
 * app-state.svelte.ts (to detect isSample via exact-text comparison). */
export const SAMPLE_PGN =
	'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';
```

In `src/lib/components/OnboardingScreen.svelte`, replace:

```ts
	const SAMPLE_PGN =
		'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';
```

with:

```ts
	import { SAMPLE_PGN } from '$lib/game/sample-pgn';
```

(add this alongside the existing `import { appState, startReview } from ...` line at the top of the `<script>` block; remove the old local `const SAMPLE_PGN = ...` entirely).

- [ ] **Step 2: Write the failing tests for `appState`'s new fields/behavior**

Replace the top of `src/lib/stores/app-state.test.ts` (its imports) with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

const { parsePgn } = vi.hoisted(() => ({ parsePgn: vi.fn() }));
vi.mock('$lib/api/pgn', () => ({ parsePgn }));

import { createAppState } from './app-state.svelte';
import {
	appState,
	getMaxPly,
	goToPly,
	stepPly,
	startReview,
	newGame,
	handleReviewKeydown
} from './app-state.svelte';
```

Then replace the existing test:
```ts
it('MAX_PLY matches the mock game length (31)', () => {
	expect(MAX_PLY).toBe(31);
});
```
with (this now needs a loaded game, since `getMaxPly()` reads `appState.game`):
```ts
it('getMaxPly returns 0 before any game is loaded, and the real length after startReview', async () => {
	expect(getMaxPly()).toBe(0);

	parsePgn.mockResolvedValue({
		sanList: Array.from({ length: 31 }, (_, i) => `move${i}`),
		positions: Array.from({ length: 32 }, () => ({})),
		moves: Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }))
	});
	loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

	await startReview();

	expect(getMaxPly()).toBe(31);
});
```

Every OTHER pre-existing test in the `beforeEach`-scoped `describe('screen/ply transitions', ...)` block that calls `goToPly`/`stepPly` directly (not `startReview`) is unaffected by this change (they set `appState.ply` manually in their own `beforeEach` and don't depend on `getMaxPly()`'s return value being any particular number for their own assertions) — EXCEPT `goToPly(999)` clamping to "MAX_PLY" — update that one assertion:

```ts
it('goToPly clamps to [0, MAX_PLY]', () => {
	goToPly(-5);
	expect(appState.ply).toBe(0);
	goToPly(999);
	expect(appState.ply).toBe(getMaxPly());
	goToPly(10);
	expect(appState.ply).toBe(10);
});
```

Add two new tests to the `describe('screen/ply transitions', ...)` block (or a new `describe` block) covering the new async success/error paths of `startReview`:

```ts
describe('startReview (real PGN parsing)', () => {
	beforeEach(() => {
		parsePgn.mockReset();
		loadRealAnalysis.mockReset();
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });
	});

	it('on successful parse: populates game, resets parseError, and loads the review screen', async () => {
		appState.pgnText = '1. e4 e5';
		appState.parseError = 'stale error from a previous attempt';
		parsePgn.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{}, {}, {}],
			moves: [
				{ from: 'e2', to: 'e4' },
				{ from: 'e7', to: 'e5' }
			]
		});

		await startReview();

		expect(parsePgn).toHaveBeenCalledWith('1. e4 e5');
		expect(appState.parseError).toBeNull();
		expect(appState.game?.sanList).toEqual(['e4', 'e5']);
		expect(appState.game?.isSample).toBe(false);
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(2);
		expect(appState.evalPerPly).toEqual([0, 0, 0]);
	});

	it('falls back to the sample PGN when pgnText is blank, and flags isSample true', async () => {
		appState.pgnText = '   ';
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		await startReview();

		const { SAMPLE_PGN } = await import('$lib/game/sample-pgn');
		expect(parsePgn).toHaveBeenCalledWith(SAMPLE_PGN);
		expect(appState.game?.isSample).toBe(true);
	});

	it('on parse failure: sets parseError and does not load the review screen', async () => {
		appState.pgnText = 'not a real pgn';
		appState.gameLoaded = false;
		parsePgn.mockRejectedValue(new Error('illegal move'));

		await startReview();

		expect(appState.parseError).toBe('illegal move');
		expect(appState.gameLoaded).toBe(false);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.game`/`appState.parseError`/`getMaxPly` don't exist yet; `MAX_PLY` import breaks other tests too (expected, being replaced in this same task).

- [ ] **Step 4: Implement the `appState` changes**

In `src/lib/stores/app-state.svelte.ts`, change the imports at the top from:

```ts
import type { Move } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST, EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
```

to:

```ts
import type { Move, Position } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
import { parsePgn } from '$lib/api/pgn';
import { SAMPLE_PGN } from '$lib/game/sample-pgn';
```

Define `GameData` locally in this file for now (Task 5 will move this exact definition into `review.ts`, since that's where it conceptually belongs once that file is rewritten, and will update this file's import to pull it from there instead — this file doesn't have a `review.ts` with this shape to import from yet at this point in the plan):

```ts
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}
```

Update the `AppState` interface, adding two fields:

```ts
export interface AppState {
	screen: Screen;
	ply: number;
	tab: Tab;
	flipped: boolean;
	sidebarCollapsed: boolean;
	gameLoaded: boolean;
	pgnText: string;
	showLines: boolean;
	selfAnalysis: boolean;
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
	game: GameData | null;
	parseError: string | null;
}
```

Update `defaultState`, adding the two fields and removing the now-unused `evalPerPly`/`bestMoves` mock-array seeding (there is no game loaded yet at app start, so these seed as empty until a game is parsed):

```ts
const defaultState: AppState = {
	screen: 'review',
	ply: 31,
	tab: 'analysis',
	flipped: false,
	sidebarCollapsed: false,
	gameLoaded: false,
	pgnText: '',
	showLines: true,
	selfAnalysis: false,
	evalPerPly: [...EVAL_PER_PLY],
	bestMoves: { ...BEST_MOVES },
	analysisStatus: 'idle',
	game: null,
	parseError: null
};
```

(Note: `EVAL_PER_PLY`/`BEST_MOVES` are still imported and still used here for the default/idle-state seed shown before any `startReview()` call — this is harmless since `screen` defaults to `'review'` but `gameLoaded` defaults to `false`, so the Onboarding screen shows, not the board; keeping this seed avoids an unrelated behavior change to `createAppState()`'s existing snapshot test.)

Replace the module-level `export const MAX_PLY = SAN_LIST.length;` with:

```ts
export function getMaxPly(): number {
	return appState.game ? appState.game.sanList.length : 0;
}
```

Update `goToPly`:

```ts
export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(getMaxPly(), ply));
}
```

Replace `startReview` (previously synchronous) with:

```ts
/** Parses the pasted/typed PGN (or the built-in sample if blank) via the real
 * Rust pgn module, replacing the mock SAN engine (LOGIC.md §7/§8). */
export async function startReview(): Promise<void> {
	const pgnToParse = appState.pgnText.trim() || SAMPLE_PGN;
	try {
		const parsed = await parsePgn(pgnToParse);
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim()
		};
		appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
		appState.bestMoves = {};
		appState.analysisStatus = 'idle';
		appState.parseError = null;
		appState.gameLoaded = true;
		appState.screen = 'review';
		appState.ply = parsed.sanList.length;
		appState.tab = 'analysis';
		void refreshRealAnalysis();
	} catch (err) {
		appState.parseError = err instanceof Error ? err.message : 'Failed to parse PGN.';
	}
}
```

`refreshRealAnalysis` (from Iteration 5) is unchanged.

- [ ] **Step 5: Update `ReviewPanel.svelte`'s `MAX_PLY` call site**

In `src/lib/components/ReviewPanel.svelte`, change:

```ts
	import { appState, goToPly, stepPly, MAX_PLY } from '$lib/stores/app-state.svelte';
```

to:

```ts
	import { appState, goToPly, stepPly, getMaxPly } from '$lib/stores/app-state.svelte';
```

and change:

```svelte
			onLast={() => goToPly(MAX_PLY)}
```

to:

```svelte
			onLast={() => goToPly(getMaxPly())}
```

- [ ] **Step 6: Add the onboarding error banner**

In `src/lib/components/OnboardingScreen.svelte`, add a conditional error message inside the `.pgn-card` div, just above the `<textarea>`:

```svelte
			{#if appState.parseError}
				<div class="parse-error">{appState.parseError}</div>
			{/if}
```

Add its style, alongside the existing `.card-header`/`textarea` rules:

```css
	.parse-error {
		margin-bottom: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-inset);
		background: rgba(242, 107, 107, 0.08);
		border: 1px solid rgba(242, 107, 107, 0.3);
		color: var(--color-blunder);
		font-size: 12px;
		line-height: 1.4;
	}
```

(Check `src/lib/tokens.ts`/`src/app.css` first for the exact existing CSS custom property name for the "blunder"/red classification color — reuse whatever already exists there, e.g. `--color-blunder` or `--color-red`, rather than introducing a new hardcoded `#F26B6B`. If no such CSS variable currently exists, use the raw `rgba(242, 107, 107, 1)` value matching `TOKENS.classification.blunder.color` from `src/lib/tokens.ts` exactly, since that's the design system's own red — do not invent a new color.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: all tests pass (existing tests + new ones).

Run: `pnpm run test -- --run`
Expected: other test files will still fail at this point (Tasks 5/6 haven't updated `review.ts`/`review.test.ts`/`mock-data.ts` yet, and `GameReviewScreen.svelte`/`AnalysisTab.svelte` still call the old `getReviewPly` signature) — this is expected; only confirm `app-state.test.ts` and `api/pgn.test.ts` pass cleanly at this point. Do not attempt to fix unrelated failing files in this task.

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/sample-pgn.ts src/lib/components/OnboardingScreen.svelte \
  src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts \
  src/lib/components/ReviewPanel.svelte
git commit -m "feat: wire startReview to real PGN parsing via the Rust pgn module"
```

---

## Task 5: `review.ts` rewrite — `GameData`, real position/move consumption

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`
- Modify: `src/lib/components/GameReviewScreen.svelte`
- Modify: `src/lib/components/AnalysisTab.svelte`

**Interfaces:**
- Consumes: `AppState.game` (Task 4, may be `null` before any game loads — components only read it after `gameLoaded` is true, guaranteed non-null by then).
- Produces (used by Task 6 and already consumed by Task 4): 
  ```ts
  export interface GameData {
      sanList: string[];
      positions: Position[];
      moveMeta: Move[];
      isSample: boolean;
  }
  export const UNCLASSIFIED_COACH_TEXT: string;
  export function getReviewPly(ply: number, game: GameData, evalPerPly?: number[], bestMoves?: Record<number, Move & {san:string}>): ReviewPly;
  export function getPlayerRows(ply: number, flipped: boolean, game: GameData): {top: PlayerRowData; bottom: PlayerRowData};
  ```

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/game/review.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import { getReviewPly, getPlayerRows, type GameData } from './review';

// moveMeta has 31 entries (index i = the move that produced ply i+1). Only
// plies 1, 2, and 31 are ever asserted on below, so every other entry is an
// inert placeholder — real values only where a test actually checks them.
const sampleMoveMeta = Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }));
sampleMoveMeta[0] = { from: 'e2', to: 'e4' }; // ply 1
sampleMoveMeta[1] = { from: 'e7', to: 'e5' }; // ply 2
sampleMoveMeta[30] = { from: 'f6', to: 'e5' }; // ply 31

const sampleGame: GameData = {
	sanList: [
		'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6',
		'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1', 'Qe7', 'Ng3', 'Rad8', 'd4',
		'exd4', 'cxd4', 'd5', 'Ne5'
	],
	positions: Array.from({ length: 32 }, () => ({})), // content unused by these tests
	moveMeta: sampleMoveMeta,
	isSample: true
};

const notSampleGame: GameData = {
	sanList: ['d4', 'd5'],
	positions: [{}, {}, {}],
	moveMeta: [
		{ from: 'd2', to: 'd4' },
		{ from: 'd7', to: 'd5' }
	],
	isSample: false
};

describe('getReviewPly', () => {
	it('ply 0 has no lastMove/classCode and the intro coach text', () => {
		const r = getReviewPly(0, sampleGame);
		expect(r.lastMove).toBeNull();
		expect(r.classCode).toBeNull();
		expect(r.coachMove).toBe('Start');
		expect(r.coachText).toBe(
			'The game begins. Step through with the arrows or arrow keys to see every move classified.'
		);
		expect(r.evalStr).toBe('+0.00');
	});

	it('ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"', () => {
		const r = getReviewPly(1, sampleGame);
		expect(r.classCode).toBe('book');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('a black ply renders "N... san" with the ellipsis separator', () => {
		const r = getReviewPly(2, sampleGame); // 1...e5
		expect(r.coachMove).toBe('1... e5');
	});

	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14, sampleGame).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy
		expect(getReviewPly(1, sampleGame).best).toBeNull(); // book, not a NOT_BEST code
	});

	it('computes whitePct via evalBarPct semantics (50 + clamp(ev/8*44))', () => {
		const r = getReviewPly(31, sampleGame); // eval 2.37
		expect(r.whitePct).toBeCloseTo(50 + Math.min(44, (2.37 / 8) * 44), 5);
	});

	it('accepts explicit evalPerPly/bestMoves overrides instead of the static mock arrays', () => {
		const r = getReviewPly(1, sampleGame, [0, 99], {});
		expect(r.evalNum).toBe(99);
		expect(r.evalStr).toBe('+99.00');
	});

	it('does not apply classification/coach text to a non-sample game', () => {
		const r = getReviewPly(1, notSampleGame);
		expect(r.classCode).toBeNull();
		expect(r.best).toBeNull();
		expect(r.coachText).toBe(
			"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview."
		);
		expect(r.coachMove).toBe('1. d4'); // sanList is still real regardless of isSample
	});
});

describe('getPlayerRows', () => {
	it('unflipped: Black on top, White on bottom (whiteAtBottom)', () => {
		const { top, bottom } = getPlayerRows(31, false, sampleGame);
		expect(top.name).toBe('DominikP');
		expect(bottom.name).toBe('Jonas');
	});

	it('flipped: White on top, Black on bottom', () => {
		const { top, bottom } = getPlayerRows(31, true, sampleGame);
		expect(top.name).toBe('Jonas');
		expect(bottom.name).toBe('DominikP');
	});

	it('highlights the clock of the side to move (odd ply = Black to move)', () => {
		const { top, bottom } = getPlayerRows(1, false, sampleGame); // ply 1 -> Black to move next
		expect(top.name).toBe('DominikP');
		expect(top.clockActive).toBe(true);
		expect(bottom.clockActive).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly`'s current signature doesn't accept a `game` argument yet; `GameData` isn't exported yet.

- [ ] **Step 3: Rewrite `review.ts`**

Replace `src/lib/game/review.ts` entirely with:

```ts
/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262).
 * Positions/moves/SAN now come from the real Rust `pgn` module's parse of
 * whatever game is loaded (`GameData`, Iteration 6) instead of a hardcoded
 * mock array. Move classification/coach text/best-move suggestions remain
 * mocked (CLASS_CODES/COACH_TEXT_MAP/BEST_MOVES in ./mock-data) and are
 * applied ONLY when `game.isSample` is true — i.e. the loaded PGN is
 * byte-identical to the one known sample game those mocks describe. A
 * genuinely different real pasted game gets real positions/moves but no
 * (rather than misleading) classification (README §11 step 6 scope).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, PieceColor, PieceType, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES } from '$lib/tokens';
import { BEST_MOVES, COACH_TEXT_MAP, EVAL_PER_PLY, CLASS_CODES, PLAYERS } from './mock-data';

export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}

export interface ReviewPly {
	position: Position;
	lastMove: Move | null;
	classCode: ClassCode | null;
	best: (Move & { san: string }) | null;
	evalNum: number;
	evalStr: string;
	whitePct: number;
	coachMove: string;
	coachText: string;
}

const INTRO_COACH_TEXT =
	'The game begins. Step through with the arrows or arrow keys to see every move classified.';

export const UNCLASSIFIED_COACH_TEXT =
	"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview.";

/**
 * Derives everything the Game Review screen needs to render a given ply:
 * the resulting position, the move that produced it, its classification,
 * the engine's suggested alternative (when the played move wasn't best),
 * the eval bar/number, and the coach card's move label + commentary.
 *
 * Mirrors the reference's renderVals() (lines 1221-1234, 1237-1239, 1325-1326).
 */
export function getReviewPly(
	ply: number,
	game: GameData,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES
): ReviewPly {
	const position = game.positions[ply];
	const lastMove = ply > 0 ? game.moveMeta[ply - 1] : null;
	const classCode: ClassCode | null =
		ply > 0 && game.isSample ? (CLASS_CODES[ply - 1] ?? null) : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + game.sanList[ply - 1] : 'Start';
	const coachText =
		ply === 0 ? INTRO_COACH_TEXT : classCode ? COACH_TEXT_MAP[classCode] : UNCLASSIFIED_COACH_TEXT;

	return {
		position,
		lastMove,
		classCode,
		best,
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}

export interface PlayerRowData {
	name: string;
	rating: string;
	initial: string;
	isWhite: boolean;
	clock: string;
	clockActive: boolean;
	captured: Array<{ color: PieceColor; type: PieceType }>;
	adv: string | null;
}

/**
 * Derives the two player-row descriptors (captured material, material
 * advantage chip, active clock) for a given ply, swapped top/bottom by the
 * `flipped` board orientation. Mirrors renderVals() lines 1244-1258. Player
 * name/rating/clock still come from the mocked `PLAYERS` (deliberately not
 * wired to real PGN tags this iteration — see the plan's Global Constraints).
 */
export function getPlayerRows(
	ply: number,
	flipped: boolean,
	game: GameData
): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = game.positions[ply];
	const cap = capturedInfo(position);
	const blackToMove = ply % 2 === 1;

	const white: PlayerRowData = {
		name: PLAYERS.white.name,
		rating: PLAYERS.white.rating,
		initial: PLAYERS.white.initial,
		isWhite: true,
		clock: PLAYERS.white.clock,
		clockActive: !blackToMove,
		captured: cap.whiteCap,
		adv: cap.adv > 0 ? '+' + cap.adv : null
	};
	const black: PlayerRowData = {
		name: PLAYERS.black.name,
		rating: PLAYERS.black.rating,
		initial: PLAYERS.black.initial,
		isWhite: false,
		clock: PLAYERS.black.clock,
		clockActive: blackToMove,
		captured: cap.blackCap,
		adv: cap.adv < 0 ? '+' + -cap.adv : null
	};

	const whiteAtBottom = !flipped;
	return whiteAtBottom ? { top: black, bottom: white } : { top: white, bottom: black };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: all tests pass.

- [ ] **Step 4b: Reconcile `app-state.svelte.ts`'s duplicate `GameData` definition**

Task 4 defined `GameData` locally inside `src/lib/stores/app-state.svelte.ts` because `review.ts` didn't have it yet at that point. Now that `review.ts` exports the real one, remove the local duplicate and import it instead. In `src/lib/stores/app-state.svelte.ts`, delete this block entirely:

```ts
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}
```

and change the import line:

```ts
import type { Move, Position } from '$lib/board/types';
```

to:

```ts
import type { GameData } from '$lib/game/review';
```

(`Move`/`Position` are no longer referenced directly in this file once the local `GameData` definition is gone — remove them from the import entirely rather than leaving an unused import. Double check: if `AppState`'s `bestMoves: Record<number, Move & { san: string }>` field still needs the `Move` type, keep `import type { Move } from '$lib/board/types';` alongside the new `GameData` import instead of removing it — check the file's actual remaining usages before deciding what to drop.)

Run: `pnpm vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts`
Expected: both still pass after the reconciliation (this is a pure refactor — same shape, different source module — so no test assertions should need to change).

- [ ] **Step 5: Update `GameReviewScreen.svelte` and `AnalysisTab.svelte` call sites**

In `src/lib/components/GameReviewScreen.svelte`, change:

```ts
	const data = $derived(getReviewPly(appState.ply, appState.evalPerPly, appState.bestMoves));
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped));
```

to:

```ts
	const data = $derived(
		getReviewPly(appState.ply, appState.game!, appState.evalPerPly, appState.bestMoves)
	);
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped, appState.game!));
```

(The non-null assertion is safe: `GameReviewScreen` only ever renders when `appState.gameLoaded` is true, which `startReview` — Task 4 — only sets after `appState.game` is successfully populated; see `src/routes/+page.svelte`'s existing `{#if appState.screen === 'review' && appState.gameLoaded}` guard.)

In `src/lib/components/AnalysisTab.svelte`, change:

```ts
	const data = $derived(getReviewPly(ply, appState.evalPerPly, appState.bestMoves));
```

to:

```ts
	const data = $derived(getReviewPly(ply, appState.game!, appState.evalPerPly, appState.bestMoves));
```

- [ ] **Step 6: Run the affected component tests**

Run: `pnpm vitest run src/lib/components/GameReviewScreen.test.ts src/lib/components/AnalysisTab.test.ts`
Expected: these will likely FAIL right now because their existing tests render the component WITHOUT first setting `appState.game` — this is expected and is fixed in the same step: open each test file and, in every `render(...)` call (or in a shared `beforeEach`), set `appState.game` to a valid `GameData` fixture (reuse a shape similar to `sampleGame` from Step 1 above, or a smaller one sufficient for that file's own assertions) before rendering. Add `import { appState } from '$lib/stores/app-state.svelte';` to each test file if not already imported. Do not skip this — get both files back to green before moving on.

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts \
  src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts \
  src/lib/components/GameReviewScreen.svelte src/lib/components/GameReviewScreen.test.ts \
  src/lib/components/AnalysisTab.svelte src/lib/components/AnalysisTab.test.ts
git commit -m "feat: wire review.ts to real per-game positions/moves via GameData"
```

---

## Task 6: Delete the mock SAN engine; trim `mock-data.ts`

**Files:**
- Delete: `src/lib/game/mock-engine.ts`
- Delete: `src/lib/game/mock-engine.test.ts`
- Modify: `src/lib/game/mock-data.ts`
- Modify: `src/lib/game/mock-data.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `mock-data.ts` no longer exports `SAN_LIST`, `MOCK_POSITIONS`, `MOCK_MOVE_META` (any remaining import of these anywhere in `src/` is now a compile error to be fixed as part of this task — there should be none left after Tasks 4/5).

- [ ] **Step 1: Confirm no remaining references before deleting**

Run: `grep -rln "mock-engine\|MOCK_POSITIONS\|MOCK_MOVE_META\|SAN_LIST" src/ --include="*.ts" --include="*.svelte"`
Expected: only `src/lib/game/mock-data.ts` and `src/lib/game/mock-data.test.ts` (about to be edited in this task) and `src/lib/game/mock-engine.ts`/`mock-engine.test.ts` (about to be deleted) should appear. If any OTHER file still references these, stop and report — it means an earlier task's call-site sweep was incomplete; do not silently patch around it without understanding why.

- [ ] **Step 2: Delete the mock engine**

```bash
rm src/lib/game/mock-engine.ts src/lib/game/mock-engine.test.ts
```

- [ ] **Step 3: Write the failing test for the trimmed `mock-data.ts`**

Replace `src/lib/game/mock-data.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import {
	CLASS_CODES,
	EVAL_PER_PLY,
	BEST_MOVES,
	COACH_TEXT_MAP,
	BREAKDOWN_ROWS,
	PHASE_ROWS,
	PLAYERS
} from './mock-data';

describe('mock-data', () => {
	it('CLASS_CODES/EVAL_PER_PLY have the sample game\'s known fixed lengths (31 plies)', () => {
		expect(CLASS_CODES).toHaveLength(31);
		expect(EVAL_PER_PLY).toHaveLength(32); // includes ply 0
	});

	it('has a coach text entry for every classification code', () => {
		for (const code of CLASS_CODES) {
			expect(COACH_TEXT_MAP[code]).toBeTruthy();
		}
	});

	it('has 10 breakdown rows and 3 phase rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
		expect(PHASE_ROWS).toHaveLength(3);
	});

	it('defines both players with a gameRating', () => {
		expect(PLAYERS.white.gameRating).toBe('1712');
		expect(PLAYERS.black.gameRating).toBe('1994');
	});

	it('has bestMoves entries matching the reference (ply 14 and 30)', () => {
		expect(BEST_MOVES[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
		expect(BEST_MOVES[30]).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' });
	});
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run src/lib/game/mock-data.test.ts`
Expected: FAIL — `mock-data.ts` still imports the deleted `mock-engine.ts` and still exports `SAN_LIST`/`MOCK_POSITIONS`/`MOCK_MOVE_META`, but that's fine as a starting point; the real failure to fix is the deleted-file import breaking the whole module. Proceed to Step 5.

- [ ] **Step 5: Trim `mock-data.ts`**

In `src/lib/game/mock-data.ts`, remove the import of `buildGame` and the `SAN_LIST`/`MOCK_POSITIONS`/`MOCK_MOVE_META` exports. Change:

```ts
import type { ClassCode } from '$lib/types';
import type { Move } from '$lib/board/types';
import { buildGame } from './mock-engine';
```

to:

```ts
import type { ClassCode } from '$lib/types';
```

(The `Move` type import and `buildGame` import are both dropped — nothing in this trimmed file needs them anymore.)

Remove these lines from the bottom of the file:

```ts
const built = buildGame(SAN_LIST);
export const MOCK_POSITIONS = built.positions;
export const MOCK_MOVE_META = built.meta;
```

Remove the `SAN_LIST` export itself (the array literal near the top of the file):

```ts
export const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];
```

Update the file's banner doc comment (at the very top of the file) to reflect the new scope. Replace it with:

```ts
/**
 * ============================================================================
 * MOCK CONTENT — describes ONLY the built-in sample game (the Italian Game
 * shown by "Paste sample game"), applied by review.ts ONLY when the currently
 * loaded game is verified byte-identical to that sample PGN (`GameData.isSample`,
 * Iteration 6). A genuinely different real pasted/typed PGN gets real positions
 * and moves (src-tauri/src/pgn.rs via shakmaty) but none of this classification/
 * coach-text/breakdown/phase/player content, since none of it can honestly
 * apply to a game these arrays were never computed from.
 * ============================================================================
 * classCodes/evalPerPly/bestMoves/coachTextMap/breakdown/phases stand in for
 * Rust analysis+engine output (README §8 mapping table) — real move
 * classification is a later iteration (OVERVIEW §11's centipawn-loss/accuracy
 * formulas are not implemented yet). players stands in for backend-computed
 * screen content (same table) — real player names/ratings from PGN tags are
 * also a later iteration. CLS itself (name/word/color/glyph) is NOT mock —
 * that already lives in TOKENS.classification (src/lib/tokens.ts) and must
 * not be redeclared here.
 */
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/mock-data.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 7: Run the FULL test suite to confirm no dangling references anywhere**

Run: `pnpm run test -- --run`
Expected: all test files pass — this confirms Tasks 4/5's call-site sweeps were complete and nothing still imports the deleted `mock-engine.ts` or the removed `mock-data.ts` exports.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete the mock SAN engine and trim mock-data.ts to sample-game-only content"
```

---

## Task 7: Final integration & verification sweep

**Files:** none created — this task runs the full verification suite and fixes anything it finds; any fix commits are additional to this task.

**Interfaces:** none new — this task only verifies Tasks 1-6 integrate cleanly.

- [ ] **Step 1: Full JS/TS test suite**

Run: `pnpm run test -- --run`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Type/lint checks**

Run: `pnpm run check`
Expected: 0 errors (pre-existing a11y/state-reference warnings from prior iterations are fine; no new errors).

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 3: Full Rust test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -60`
Expected: all tests pass (Task 1's `pgn` module tests + Task 2's command tests + all of Iteration 5's `engine`/`analyze_fen` tests, including the real-Stockfish test — confirm it still runs for real, not skipped).

Run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Frontend build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual end-to-end smoke test (documented limitation)**

This is a headless sandbox with no display server — a native Tauri window cannot be opened here (same limitation as Iteration 5). Do NOT attempt `pnpm tauri dev`. Instead, record in the ledger that a human with a real display should verify, before merging:
- The sample game ("Paste sample game" → "Start Review") still looks and behaves pixel-identical to before this iteration (classification badges, coach text, breakdown/phase tables all present, since `isSample` is true for it).
- Pasting a DIFFERENT valid PGN (any real game) and clicking "Start Review" shows the real moves/positions with no classification badges and the `UNCLASSIFIED_COACH_TEXT` message, and move navigation (arrow keys, First/Prev/Next/Last) works across its real move count.
- Typing garbage text and clicking "Start Review" shows the new parse-error banner and stays on the onboarding screen.

- [ ] **Step 6: Update the ledger**

Append to `.superpowers/sdd/progress.md`:

```
---
Iteration 6 (PGN parse via shakmaty + move navigation):
Task 1: complete (...)
...
Final verification sweep: complete (lint/check/test/build all pass; cargo test passes including the real-Stockfish test from Iteration 5 and the new pgn module's regression tests against the known sample game; manual GUI PGN-paste smoke test could not be run in this headless sandbox — flagged for the user to verify with a real display).
```

(Fill in actual commit ranges per task as they land — this is a template, not literal ledger text to copy verbatim.)

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification sweep for iteration 6"
```

(Skip this step entirely if Steps 1-4 found nothing to fix.)
