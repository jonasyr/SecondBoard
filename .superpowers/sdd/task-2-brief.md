### Task 2: Thread the second PV line through `lib.rs` and the TS API layer

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/api/engine.ts`

**Interfaces:**
- Consumes: `engine::EngineAnalysis.second_eval_cp/second_is_mate/second_wdl` (Task 1).
- Produces: `AnalyzeFenResult.secondEvalCp: number | null`, `AnalyzeFenResult.secondIsMate: boolean`, `AnalyzeFenResult.secondWdl: [number, number, number] | null` (both Rust and TS sides).

- [ ] **Step 1: Add the fields to Rust's `AnalyzeFenResult` and its `From` impl**

Current code in `src-tauri/src/lib.rs`:
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

Replace with:
```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyzeFenResult {
    eval_cp: i32,
    is_mate: bool,
    best_move_uci: String,
    pv: Vec<String>,
    wdl: Option<(u32, u32, u32)>,
    second_eval_cp: Option<i32>,
    second_is_mate: bool,
    second_wdl: Option<(u32, u32, u32)>,
}

impl From<engine::EngineAnalysis> for AnalyzeFenResult {
    fn from(a: engine::EngineAnalysis) -> Self {
        AnalyzeFenResult {
            eval_cp: a.eval_cp,
            is_mate: a.is_mate,
            best_move_uci: a.best_move_uci,
            pv: a.pv,
            wdl: a.wdl,
            second_eval_cp: a.second_eval_cp,
            second_is_mate: a.second_is_mate,
            second_wdl: a.second_wdl,
        }
    }
}
```

- [ ] **Step 2: Update the existing Rust test that constructs an `AnalyzeFenResult` expectation**

`analyze_fen_result_carries_the_engines_wdl_field` (in `mod analyze_fen_tests`) only asserts on `result.wdl`, not on the full struct shape — no change needed. Add one new test in the same module (after it):
```rust
    #[test]
    fn analyze_fen_result_carries_the_engines_second_pv_line() {
        let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1".to_string();
        match analyze_fen_sync(fen) {
            Ok(result) => {
                assert!(result.second_eval_cp.is_some());
            }
            Err(msg) => {
                assert!(msg.contains("failed to spawn engine"), "unexpected error: {msg}");
            }
        }
    }
```

- [ ] **Step 3: Run the Rust suite**

Run: `cd src-tauri && cargo test`
Expected: PASS (all suites, including the new test).

- [ ] **Step 4: Update the TS `AnalyzeFenResult` type**

Current code in `src/lib/api/engine.ts`:
```typescript
export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
	wdl: [number, number, number] | null;
}
```

Replace with:
```typescript
export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
	wdl: [number, number, number] | null;
	secondEvalCp: number | null;
	secondIsMate: boolean;
	secondWdl: [number, number, number] | null;
}
```

`src/lib/api/engine.test.ts` exists and passes through mock `invoke` results structurally (it never constructs an `AnalyzeFenResult` type literal, just asserts on individual fields) — this type-only addition doesn't require changes there. Run it anyway to confirm: `rtk proxy pnpm exec vitest run src/lib/api/engine.test.ts` — expect PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src/lib/api/engine.ts
git commit -m "feat(engine): surface the second MultiPV line through analyze_fen and its TS type"
```

---

