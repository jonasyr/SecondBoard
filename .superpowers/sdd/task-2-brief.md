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

