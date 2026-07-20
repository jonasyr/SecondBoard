### Task 1: MultiPV support in the Rust engine layer

**Files:**
- Modify: `src-tauri/src/engine.rs`

**Interfaces:**
- Produces: `InfoLine.multipv: Option<u32>`; `EngineAnalysis.second_eval_cp: Option<i32>`, `EngineAnalysis.second_is_mate: bool`, `EngineAnalysis.second_wdl: Option<(u32, u32, u32)>`.

Real Stockfish, when `MultiPV` is set above 1, tags every `info` line with a `multipv N` token (1-indexed) identifying which principal variation that line describes, e.g.:
```
info depth 16 seldepth 20 multipv 1 score cp 34 wdl 550 350 100 nodes 500000 pv e2e4 e7e5
info depth 16 seldepth 18 multipv 2 score cp -12 wdl 400 400 200 nodes 300000 pv d2d4 d7d5
```
Lines without a `multipv` token (older engines / `MultiPV=1` default) describe PV line 1.

- [ ] **Step 1: Add `multipv` parsing to `InfoLine`/`parse_info_line`, write the failing tests first**

In `src-tauri/src/engine.rs`, add to the `InfoLine` struct (after `pub wdl: Option<(u32, u32, u32)>,`):
```rust
    pub multipv: Option<u32>,
```

Add these tests inside `mod parse_tests` (after `parses_wdl_triple`):
```rust
    #[test]
    fn parses_the_multipv_index() {
        let line = "info depth 16 multipv 2 score cp -12 pv d2d4 d7d5";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.multipv, Some(2));
    }

    #[test]
    fn defaults_multipv_to_none_when_the_engine_omits_the_token() {
        let line = "info depth 16 score cp 34 pv e2e4";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.multipv, None);
    }
```

Run: `cd src-tauri && cargo test engine::parse_tests`
Expected: FAIL to compile — every existing `InfoLine { ... }` struct literal in the test module (the `resolve_score_*` tests) is missing the new `multipv` field, and the two new tests fail on a missing `multipv` field on `InfoLine`.

- [ ] **Step 2: Parse the `multipv` token in `parse_info_line`, and add `multipv: None` to the existing struct literals**

In `parse_info_line`'s `match tokens[i] { ... }`, add a new arm right after the `"wdl"` arm (before `"pv" =>`):
```rust
            "multipv" if i + 1 < tokens.len() => {
                info.multipv = tokens[i + 1].parse().ok();
                i += 2;
            }
```
Note: this arm intentionally does **not** set `found_score_or_pv = true` — a bare `multipv` token without any score is not itself evidence of a usable info line (mirrors why `pv`/`cp`/`mate`/`wdl` are the only fields that set that flag).

In every existing `InfoLine { score_cp: ..., score_mate: ..., wdl: ..., pv: ... }` struct literal in `mod parse_tests` (the five `resolve_score_*` tests), add `multipv: None,` as a field (Rust requires every field on explicit struct-literal construction).

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd src-tauri && cargo test engine::parse_tests`
Expected: PASS (16 tests: the existing 14 plus the 2 new ones).

- [ ] **Step 4: Add second-PV-line fields to `EngineAnalysis`, request `MultiPV=2`, and track per-PV-index info lines in `analyze_position`**

Add to the `EngineAnalysis` struct (after `pub wdl: Option<(u32, u32, u32)>,`):
```rust
    pub second_eval_cp: Option<i32>,
    pub second_is_mate: bool,
    pub second_wdl: Option<(u32, u32, u32)>,
```

In `analyze_position`, add the MultiPV option right after the existing `UCI_ShowWDL` line:
```rust
    write_line(&mut stdin, "setoption name UCI_ShowWDL value true")?;
    write_line(&mut stdin, "setoption name MultiPV value 2")?;
```

Replace the analysis loop's tracking variable and the `bestmove` branch. Current code:
```rust
    let mut last_info: Option<InfoLine> = None;
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| EngineError::Io(e.to_string()))?;
        if n == 0 {
            return Err(EngineError::Io("engine closed stdout mid-analysis".into()));
        }
        let trimmed = line.trim_end();
        if let Some(info) = parse_info_line(trimmed) {
            if info.score_cp.is_some() || info.score_mate.is_some() {
                last_info = Some(info);
            }
        } else if let Some(best) = parse_bestmove_line(trimmed) {
            let _ = write_line(&mut stdin, "quit");
            let _ = child.wait();
            let info = last_info.ok_or(EngineError::NoBestMove)?;
            let (eval_cp, is_mate) = resolve_score(&info)?;
            return Ok(EngineAnalysis {
                eval_cp,
                is_mate,
                best_move_uci: best,
                pv: info.pv,
                wdl: info.wdl,
            });
        }
    }
```

Replace with:
```rust
    let mut last_info_by_pv: std::collections::HashMap<u32, InfoLine> = std::collections::HashMap::new();
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| EngineError::Io(e.to_string()))?;
        if n == 0 {
            return Err(EngineError::Io("engine closed stdout mid-analysis".into()));
        }
        let trimmed = line.trim_end();
        if let Some(info) = parse_info_line(trimmed) {
            if info.score_cp.is_some() || info.score_mate.is_some() {
                // Engines that don't emit `multipv` at all (or omit it on PV 1)
                // describe PV line 1 by convention.
                let pv_index = info.multipv.unwrap_or(1);
                last_info_by_pv.insert(pv_index, info);
            }
        } else if let Some(best) = parse_bestmove_line(trimmed) {
            let _ = write_line(&mut stdin, "quit");
            let _ = child.wait();
            let primary = last_info_by_pv.get(&1).ok_or(EngineError::NoBestMove)?;
            let (eval_cp, is_mate) = resolve_score(primary)?;
            let second = last_info_by_pv.get(&2);
            let (second_eval_cp, second_is_mate) = match second.map(resolve_score) {
                Some(Ok((cp, mate))) => (Some(cp), mate),
                _ => (None, false),
            };
            let second_wdl = second.and_then(|i| i.wdl);
            return Ok(EngineAnalysis {
                eval_cp,
                is_mate,
                best_move_uci: best,
                pv: primary.pv.clone(),
                wdl: primary.wdl,
                second_eval_cp,
                second_is_mate,
                second_wdl,
            });
        }
    }
```

- [ ] **Step 5: Update the real-engine tests for the new fields and add MultiPV coverage**

`analyzes_the_starting_position_with_a_real_stockfish` and `analyzes_the_starting_position_and_reports_a_roughly_even_wdl` construct `EngineAnalysis` only via `analyze_position`'s return value (no struct literals to fix) — no changes needed there. Add a new test in `mod analyze_tests` (after `analyzes_the_starting_position_and_reports_a_roughly_even_wdl`):
```rust
    #[test]
    fn reports_a_second_pv_line_from_the_starting_position() {
        if !stockfish_available() {
            eprintln!("skipping MultiPV test: stockfish not found on PATH");
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
        assert!(
            result.second_eval_cp.is_some(),
            "MultiPV=2 should surface a second PV line's eval for the starting position"
        );
    }
```

- [ ] **Step 6: Run the full engine test suite**

Run: `cd src-tauri && cargo test engine::`
Expected: PASS (all parse tests + all analyze tests, including the 2 new ones).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/engine.rs
git commit -m "feat(engine): parse a second MultiPV line's eval/WDL alongside the primary line"
```

---

