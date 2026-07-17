## Task 1: Rust — extract the PGN `Result` tag

**Files:**
- Modify: `src-tauri/src/pgn.rs`

**Interfaces:**
- Produces: `pgn::ParsedGame.result: Option<String>` — camelCase-serialized as `result` (e.g. `Some("0-1".to_string())`, or `None` if the tag is absent/unknown, reusing the existing `decode_known_tag` helper).

- [ ] **Step 1: Write the failing tests**

Add to the `#[cfg(test)] mod tests` block in `src-tauri/src/pgn.rs`, right after the existing `extracts_player_names_and_ratings_from_tags` test:

```rust
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test pgn::tests`
Expected: FAIL — `no field \`result\` on type \`pgn::ParsedGame\`` (compile error).

- [ ] **Step 3: Add the field and tag extraction**

In `src-tauri/src/pgn.rs`, modify `ParsedGame`:

```rust
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
```

Modify `GameVisitor`:

```rust
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
```

```rust
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
```

In `impl Visitor for GameVisitor`, extend the `tag` match arm:

```rust
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
```

And extend `end_game`:

```rust
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test pgn::tests`
Expected: PASS — all `pgn::tests::*` tests green, including the two new ones. `"?"` is already handled generically by `decode_known_tag`, so a `[Result "*"]` (PGN's own "unknown/ongoing" placeholder) also correctly becomes `None`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/pgn.rs
git commit -m "feat(pgn): extract the Result PGN tag into ParsedGame"
```

---

