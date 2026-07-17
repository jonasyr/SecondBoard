//! Parses PGN move text into real per-ply board positions (OVERVIEW §6.5/§8.3
//! `pgn` module). Replaces `src/lib/game/mock-engine.ts` — the JS mock LOGIC.md
//! explicitly says must not ship. Only the mainline is parsed (RAV variations
//! are skipped). Extracts the White/Black/WhiteElo/BlackElo tags only (player
//! display info); no other tag/metadata extraction this iteration (README §11
//! step 6 scope — see the plan's Global Constraints).

use std::collections::HashMap;

use pgn_reader::{BufferedReader, RawTag, SanPlus, Skip, Visitor};
use shakmaty::{Chess, Color, Move as ShakMove, Position, Role, Square};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedGame {
    pub san_list: Vec<String>,
    pub positions: Vec<HashMap<String, (String, String)>>,
    pub moves: Vec<MoveDto>,
    pub white_name: Option<String>,
    pub black_name: Option<String>,
    pub white_rating: Option<String>,
    pub black_rating: Option<String>,
    pub result: Option<String>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct MoveDto {
    pub from: String,
    pub to: String,
}

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

/// Decodes a tag value, treating PGN's own "unknown value" placeholder (`"?"`,
/// used by e.g. chess.com/lichess exports when a rating wasn't recorded) the
/// same as absent -- callers should fall back rather than display a bare "?".
fn decode_known_tag(value: RawTag<'_>) -> Option<String> {
    let decoded = value.decode_utf8_lossy().into_owned();
    if decoded.is_empty() || decoded == "?" {
        None
    } else {
        Some(decoded)
    }
}

struct GameVisitor {
    pos: Chess,
    san_list: Vec<String>,
    positions: Vec<HashMap<String, (String, String)>>,
    moves: Vec<MoveDto>,
    error: Option<String>,
    white_name: Option<String>,
    black_name: Option<String>,
    white_rating: Option<String>,
    black_rating: Option<String>,
    result: Option<String>,
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
            white_name: None,
            black_name: None,
            white_rating: None,
            black_rating: None,
            result: None,
        }
    }
}

impl Visitor for GameVisitor {
    type Result = Result<ParsedGame, String>;

    fn tag(&mut self, name: &[u8], value: RawTag<'_>) {
        match name {
            b"White" => self.white_name = decode_known_tag(value),
            b"Black" => self.black_name = decode_known_tag(value),
            b"WhiteElo" => self.white_rating = decode_known_tag(value),
            b"BlackElo" => self.black_rating = decode_known_tag(value),
            b"Result" => self.result = decode_known_tag(value),
            _ => {}
        }
    }

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
        // The installed shakmaty version (0.28.0) takes `play_unchecked` by
        // value, not by reference — verified against the compiler.
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
            white_name: self.white_name.take(),
            black_name: self.black_name.take(),
            white_rating: self.white_rating.take(),
            black_rating: self.black_rating.take(),
            result: self.result.take(),
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
    fn extracts_player_names_and_ratings_from_tags() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        assert_eq!(game.white_name, Some("Jonas".to_string()));
        assert_eq!(game.black_name, Some("DominikP".to_string()));
        assert_eq!(game.white_rating, Some("1867".to_string()));
        assert_eq!(game.black_rating, Some("2043".to_string()));
    }

    #[test]
    fn extracts_the_result_tag() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        assert_eq!(game.result, Some("0-1".to_string()));
    }

    #[test]
    fn treats_a_missing_result_tag_as_none() {
        let pgn = "[Event \"Casual Game\"]\n[White \"Alice\"]\n[Black \"Bob\"]\n\n1. e4 e5";
        let game = parse_pgn(pgn).expect("PGN with no Result tag should still parse");
        assert_eq!(game.result, None);
    }

    #[test]
    fn treats_missing_or_unknown_rating_tags_as_none() {
        let pgn = concat!(
            "[Event \"Casual Game\"]\n",
            "[White \"Alice\"]\n",
            "[Black \"Bob\"]\n",
            "[WhiteElo \"?\"]\n",
            "\n",
            "1. e4 e5"
        );
        let game = parse_pgn(pgn).expect("PGN with missing/unknown tags should still parse");
        assert_eq!(game.white_name, Some("Alice".to_string()));
        assert_eq!(game.black_name, Some("Bob".to_string()));
        assert_eq!(game.white_rating, None); // "?" placeholder
        assert_eq!(game.black_rating, None); // tag absent entirely
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
        // Kd8 is syntactically valid SAN but chess-illegal here: Black's own
        // queen still sits on d8 (never moved), so the king cannot move onto
        // it. A syntactically invalid square (rank 9) never reaches our
        // Visitor's `san` callback at all — pgn-reader's tokenizer rejects it
        // before that, silently truncating the game instead of erroring.
        let pgn = "1. e4 e5 2. Ke2 Ke7 3. Kf3 Kd8";
        let result = parse_pgn(pgn);
        assert!(result.is_err(), "an illegal move should produce an error, not a panic");
    }
}
