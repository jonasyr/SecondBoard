## Task 2: Rust `lib.rs` — expose `wdl` through the `analyze_fen` Tauri command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `engine::EngineAnalysis.wdl: Option<(u32, u32, u32)>` (Task 1).
- Produces: `AnalyzeFenResult.wdl: Option<(u32, u32, u32)>` — serializes as a JSON 3-element array or `null` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Add to the `#[cfg(test)] mod analyze_fen_tests` block in `src-tauri/src/lib.rs`, right after `analyze_fen_command_delegates_to_the_engine_module`:

```rust
    #[test]
    fn analyze_fen_result_carries_the_engines_wdl_field() {
        let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1".to_string();
        match analyze_fen_sync(fen) {
            Ok(result) => {
                // Real Stockfish on this machine should report WDL for a legal position.
                assert!(result.wdl.is_some());
            }
            Err(msg) => {
                assert!(msg.contains("failed to spawn engine"), "unexpected error: {msg}");
            }
        }
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test analyze_fen_tests`
Expected: FAIL — `no field \`wdl\` on type \`AnalyzeFenResult\`` (compile error).

- [ ] **Step 3: Add `wdl` to `AnalyzeFenResult` and its `From` impl**

In `src-tauri/src/lib.rs`, modify `AnalyzeFenResult`:

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyzeFenResult {
    eval_cp: i32,
    is_mate: bool,
    best_move_uci: String,
    pv: Vec<String>,
    wdl: Option<(u32, u32, u32)>,
}
```

Modify the `From<engine::EngineAnalysis>` impl:

```rust
impl From<engine::EngineAnalysis> for AnalyzeFenResult {
    fn from(a: engine::EngineAnalysis) -> Self {
        AnalyzeFenResult {
            eval_cp: a.eval_cp,
            is_mate: a.is_mate,
            best_move_uci: a.best_move_uci,
            pv: a.pv,
            wdl: a.wdl,
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: PASS — full Rust suite green, including the new `analyze_fen_result_carries_the_engines_wdl_field` test.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: expose engine WDL through the analyze_fen Tauri command"
```

---

