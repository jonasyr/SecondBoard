## Task 1: Rust `engine.rs` — parse `wdl` from UCI `info` lines

**Files:**
- Modify: `src-tauri/src/engine.rs`

**Interfaces:**
- Produces: `InfoLine.wdl: Option<(u32, u32, u32)>` and `EngineAnalysis.wdl: Option<(u32, u32, u32)>` — consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Add to the `#[cfg(test)] mod parse_tests` block in `src-tauri/src/engine.rs`, right after the existing `parses_mate_score` test:

```rust
    #[test]
    fn parses_wdl_triple() {
        let line = "info depth 16 score cp 34 wdl 500 400 100 nodes 500000 pv e2e4";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.wdl, Some((500, 400, 100)));
    }

    #[test]
    fn leaves_wdl_none_when_the_engine_does_not_report_it() {
        let line = "info depth 16 score cp 34 pv e2e4";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.wdl, None);
    }
```

Add to the `#[cfg(test)] mod analyze_tests` block, right after `analyzes_the_starting_position_with_a_real_stockfish`:

```rust
    #[test]
    fn analyzes_the_starting_position_and_reports_a_roughly_even_wdl() {
        if !stockfish_available() {
            eprintln!("skipping analyze_position WDL test: stockfish not found on PATH");
            return;
        }
        let opts = EngineOptions {
            depth: 10,
            movetime_ms: Some(1000),
        };
        let result = analyze_position(
            "stockfish",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
            &opts,
        )
        .expect("analysis should succeed against a real engine");
        let (w, d, l) = result.wdl.expect("a modern Stockfish build should report WDL");
        assert_eq!(w + d + l, 1000, "WDL per-mille components should sum to 1000");
        assert!(w > 100 && l > 100, "startpos WDL should not be lopsided: got w={w} d={d} l={l}");
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test engine::parse_tests`
Expected: FAIL — `no field \`wdl\` on type \`engine::InfoLine\`` (compile error).

- [ ] **Step 3: Add `wdl` to `InfoLine`, parse it, and carry it into `EngineAnalysis`**

In `src-tauri/src/engine.rs`, modify the `InfoLine` struct:

```rust
#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct InfoLine {
    pub score_cp: Option<i32>,
    pub score_mate: Option<i32>,
    pub wdl: Option<(u32, u32, u32)>,
    pub pv: Vec<String>,
}
```

Extend `parse_info_line`'s token loop — add a `"wdl"` arm right after the existing `"mate"` arm:

```rust
            "mate" if i + 1 < tokens.len() => {
                info.score_mate = tokens[i + 1].parse().ok();
                found_score_or_pv = true;
                i += 2;
            }
            "wdl" if i + 3 < tokens.len() => {
                let w = tokens[i + 1].parse().ok();
                let d = tokens[i + 2].parse().ok();
                let l = tokens[i + 3].parse().ok();
                if let (Some(w), Some(d), Some(l)) = (w, d, l) {
                    info.wdl = Some((w, d, l));
                    found_score_or_pv = true;
                }
                i += 4;
            }
```

Modify the `EngineAnalysis` struct:

```rust
#[derive(Debug, Clone, PartialEq)]
pub struct EngineAnalysis {
    pub eval_cp: i32,
    pub is_mate: bool,
    pub best_move_uci: String,
    pub pv: Vec<String>,
    pub wdl: Option<(u32, u32, u32)>,
}
```

In `analyze_position`, populate the new field from the last-seen `InfoLine` (modify the `Ok(EngineAnalysis { ... })` construction):

```rust
            let info = last_info.ok_or(EngineError::NoBestMove)?;
            let (eval_cp, is_mate) = resolve_score(&info)?;
            return Ok(EngineAnalysis {
                eval_cp,
                is_mate,
                best_move_uci: best,
                pv: info.pv,
                wdl: info.wdl,
            });
```

Enable `UCI_ShowWDL` in the UCI setup — add this line right after the existing `setoption name Hash value 256` call:

```rust
    write_line(&mut stdin, &format!("setoption name Threads value {threads}"))?;
    write_line(&mut stdin, "setoption name Hash value 256")?;
    write_line(&mut stdin, "setoption name UCI_ShowWDL value true")?;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test engine::`
Expected: PASS — all `engine::parse_tests::*` and `engine::analyze_tests::*` tests green, including the two new parse tests and the new real-engine WDL test (which self-skips with a message if Stockfish isn't on `PATH`, matching the existing pattern).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engine.rs
git commit -m "feat(engine): parse Stockfish WDL output via UCI_ShowWDL"
```

---

