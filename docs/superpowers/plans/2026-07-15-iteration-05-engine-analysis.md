# Iteration 5 — Rust `analyze_fen` + Stockfish UCI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Rust `engine` module that drives a real Stockfish process over UCI, expose it as the Tauri command `analyze_fen(fen) -> { evalCp, isMate, bestMoveUci, pv }` (LOGIC.md §7's explicit "Phase-0 spike"), and replace the Game Review screen's static `EVAL_PER_PLY`/`BEST_MOVES` mock arrays with real Stockfish output for the existing mock Italian Game.

**Architecture:** A dependency-free (`std`-only) Rust `engine` module spawns `stockfish` from `PATH`, performs the UCI handshake, and parses `info`/`bestmove` lines; its string-parsing logic is unit-tested without a process, its process-orchestration logic is smoke-tested against a real installed Stockfish binary (gracefully skipped if absent). On the frontend, a new pure `notation.ts` module derives a (simplified) FEN string per ply from the existing mock `Position` data, `api/engine.ts` wraps the Tauri `invoke` call (mirroring the existing `api/window.ts` convention), and `game/engine-analysis.ts` fans out one `analyze_fen` call per ply and reshapes the results into the same `evalPerPly`/`bestMoves` shape the mock arrays used. `appState` gains `evalPerPly`/`bestMoves`/`analysisStatus` fields, seeded from the mock arrays and asynchronously replaced with real data when `startReview()` fires. `getReviewPly` gains two optional parameters (defaulting to the static mock arrays, so its existing unit tests are untouched) so components can pass the live `appState` data through explicitly.

**Tech Stack:** Rust (`std::process`/`std::io` only — no new crates), Tauri v2 commands, SvelteKit + Svelte 5 (runes), TypeScript strict, Vitest, Cargo's built-in test harness.

## Global Constraints

- **No new Rust dependencies.** `src-tauri/Cargo.toml` already has `serde`, `serde_json`, `tauri`, `tauri-plugin-log`. The `engine` module uses only `std::process::Command`/`std::io` — do not add `tokio`, `tauri-plugin-shell`, or any UCI crate. `tauri-plugin-shell`'s sidecar mechanism is for *bundled* binaries (packaging, OVERVIEW §6.9/§26, out of scope until iteration 9); this iteration locates Stockfish via `PATH` (`std::process::Command::new("stockfish")`) because a real Stockfish 18 binary is installed system-wide on the dev machine. Document this PATH-lookup assumption in the `engine` module's doc comment; a later iteration (settings module, README §11 step 7) will make the engine path configurable.
- **Chess-logic scope boundary stays where iteration 4 left it.** `src/lib/game/mock-engine.ts` (the mock SAN→position engine) is untouched this iteration — replacing it with real `shakmaty`-based PGN parsing is explicitly README §11 step 6, a later iteration. Do not add the `shakmaty` crate. Do not touch `mock-engine.ts`'s move-generation logic. `CLASS_CODES`/`coachTextMap` (move classification + coach text) also stay mocked — this iteration only replaces the eval number and best-move suggestion, per LOGIC.md §7's `analyze_fen` scope.
- **FEN is a deliberately simplified serialization, not real chess-rules tracking.** `positionToFen` (Task 4) hardcodes castling rights and en-passant to `-` and the halfmove clock to `0`, because the existing mock `Position` shape (`src/lib/board/types.ts`) carries none of that state. This is acceptable because LOGIC.md §7 itself labels `analyze_fen` a "Phase-0 spike"; real castling/en-passant tracking arrives with `shakmaty` in the later PGN-parsing iteration, which supersedes this module. Do not attempt to reconstruct castling/en-passant history from `MOCK_MOVE_META` — that effort belongs to the real `pgn` module.
- **`moveToSan` (Task 4) is a minimal, non-disambiguating SAN approximation** (piece letter + optional `x` + destination square) used only to render the engine's best-move suggestion text. It does not resolve the case where two identical pieces could reach the same destination square — a real SAN generator needs full legal-move generation, which is explicitly out of scope (see above). This is acceptable for the two known best-move cases this mock game produces (`Bg4`, `Ng4`) and any other engine suggestion in the same unambiguous shape.
- **Eval sign convention: always White's point of view.** Stockfish's UCI `score cp`/`score mate` is relative to the side to move at the analyzed FEN. `evalPerPly` (like the mock array it replaces) must be from **White's** POV (positive = good for White) to stay compatible with `evalBarPct` (`src/lib/board/geometry.ts:130-132`) and every existing consumer. Negate the engine's score when the analyzed position has Black to move (Task 6).
- **No engine timeout/crash-recovery hardening this iteration.** `engine::analyze_position` bounds Stockfish's own "go" time budget via `movetime_ms` but does not add a wall-clock watchdog around the blocking reads, and does not restart a crashed process. OVERVIEW §8.3 lists "timeout handling" and "crash handling" as full `engine`-module responsibilities, but building that now would be premature for a Phase-0 spike with a single fixed analysis mode — defer it to whichever later iteration adds the real batched `analyze_game` job (README §11 step 8/OVERVIEW §10.2).
- **Engine defaults come straight from OVERVIEW §10.3/§10.4** (Standard Review): `depth: 16`, a `movetime_ms` safety cap of `2000`. `MultiPV` stays at the UCI default (1) since only the single best move/eval is needed this iteration (no alternate-lines UI yet).
- **Reuse `TOKENS`/existing CSS custom properties for the one new bit of UI** (the "Analyzing…" indicator, Task 8) — no new hardcoded hex values, matching every prior iteration's Global Constraints.
- **Svelte 5 runes only** (`$state`, `$derived`, `$props`, `$effect`). TypeScript strict mode; no `any`. Rust: no `unwrap()` in non-test code paths that can observably fail (process spawn, I/O) — return `Result`/`EngineError` instead.
- **Serde boundary is camelCase.** The Rust `AnalyzeFenResult` struct is `#[serde(rename_all = "camelCase")]` so the JSON crossing into TypeScript matches this codebase's existing camelCase convention (`eval_cp` → `evalCp`, etc.) rather than leaking Rust's snake_case.
- **Backward-compatible signature extension, not a breaking change.** `getReviewPly`'s two new parameters (Task 6) are optional with defaults equal to today's behavior — every existing call site and existing test in `review.test.ts` continues to pass unmodified until a task explicitly updates a call site to pass live data through.
- **Ledger discipline.** After each task's review passes, append one line to `.superpowers/sdd/progress.md` under a new `Iteration 5 (Rust analyze_fen + Stockfish UCI):` heading, matching the terse style of the Iteration 1-4 entries already in that file. Never rewrite prior entries.

---

## Task 1: Rust `engine` module — pure UCI line parsers

**Files:**
- Create: `src-tauri/src/engine.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod engine;` near the top, above the `run` function)

**Interfaces:**
- Produces (used by Task 2): `pub(crate) fn parse_info_line(line: &str) -> Option<InfoLine>` where
  ```rust
  #[derive(Debug, Default, Clone, PartialEq)]
  pub(crate) struct InfoLine {
      pub score_cp: Option<i32>,
      pub score_mate: Option<i32>,
      pub pv: Vec<String>,
  }
  ```
- Produces (used by Task 2): `pub(crate) fn parse_bestmove_line(line: &str) -> Option<String>` (returns just the best-move UCI token, e.g. `"e2e4"`; ignores any `ponder` token).

- [ ] **Step 1: Write the failing tests**

Create `src-tauri/src/engine.rs` with just the test module first:

```rust
//! Drives a real Stockfish process over UCI (OVERVIEW §6.6/§8.3 `engine` module).
//! Locates the binary via `PATH` (`std::process::Command::new("stockfish")`) — this
//! iteration assumes a system-installed Stockfish; a later iteration (settings module)
//! makes the path configurable. No timeout/crash-recovery watchdog yet (Phase-0 spike,
//! see the plan's Global Constraints) — Stockfish's own `movetime` bounds each call.

#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct InfoLine {
    pub score_cp: Option<i32>,
    pub score_mate: Option<i32>,
    pub pv: Vec<String>,
}

#[cfg(test)]
mod parse_tests {
    use super::*;

    #[test]
    fn parses_cp_score_and_pv() {
        let line = "info depth 16 seldepth 20 multipv 1 score cp 34 nodes 500000 nps 900000 pv e2e4 e7e5 g1f3";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.score_cp, Some(34));
        assert_eq!(info.score_mate, None);
        assert_eq!(info.pv, vec!["e2e4", "e7e5", "g1f3"]);
    }

    #[test]
    fn parses_mate_score() {
        let line = "info depth 8 score mate 3 pv f7f5 g2g4";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.score_mate, Some(3));
        assert_eq!(info.score_cp, None);
    }

    #[test]
    fn ignores_non_info_lines() {
        assert_eq!(parse_info_line("id name Stockfish 18"), None);
        assert_eq!(parse_info_line("uciok"), None);
    }

    #[test]
    fn ignores_info_lines_with_no_score_or_pv() {
        assert_eq!(parse_info_line("info string NNUE evaluation using nn-abc.nnue"), None);
    }

    #[test]
    fn parses_bestmove_with_ponder() {
        assert_eq!(parse_bestmove_line("bestmove e2e4 ponder e7e5"), Some("e2e4".to_string()));
    }

    #[test]
    fn parses_bestmove_without_ponder() {
        assert_eq!(parse_bestmove_line("bestmove g1f3"), Some("g1f3".to_string()));
    }

    #[test]
    fn rejects_non_bestmove_lines() {
        assert_eq!(parse_bestmove_line("info depth 1"), None);
    }
}
```

Add `mod engine;` to `src-tauri/src/lib.rs` just above `#[cfg_attr(mobile, tauri::mobile_entry_point)]`.

- [ ] **Step 2: Run tests to verify they fail (compile error — functions don't exist yet)**

Run: `cd src-tauri && cargo test --lib engine:: 2>&1 | tail -30`
Expected: FAIL — `error[E0425]: cannot find function `parse_info_line` in this scope` (and same for `parse_bestmove_line`).

- [ ] **Step 3: Implement the two pure parsers**

Insert above the `#[cfg(test)]` module in `src-tauri/src/engine.rs`:

```rust
pub(crate) fn parse_info_line(line: &str) -> Option<InfoLine> {
    if !line.starts_with("info ") {
        return None;
    }
    let tokens: Vec<&str> = line.split_whitespace().collect();
    let mut info = InfoLine::default();
    let mut found_score_or_pv = false;
    let mut i = 0;
    while i < tokens.len() {
        match tokens[i] {
            "cp" if i + 1 < tokens.len() => {
                info.score_cp = tokens[i + 1].parse().ok();
                found_score_or_pv = true;
                i += 2;
            }
            "mate" if i + 1 < tokens.len() => {
                info.score_mate = tokens[i + 1].parse().ok();
                found_score_or_pv = true;
                i += 2;
            }
            "pv" => {
                info.pv = tokens[i + 1..].iter().map(|s| s.to_string()).collect();
                found_score_or_pv = true;
                i = tokens.len();
            }
            _ => i += 1,
        }
    }
    if found_score_or_pv {
        Some(info)
    } else {
        None
    }
}

pub(crate) fn parse_bestmove_line(line: &str) -> Option<String> {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    if tokens.first() != Some(&"bestmove") {
        return None;
    }
    tokens.get(1).map(|s| s.to_string())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib engine:: 2>&1 | tail -30`
Expected: `test result: ok. 7 passed; 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engine.rs src-tauri/src/lib.rs
git commit -m "feat: add UCI info/bestmove line parsers for the engine module"
```

---

## Task 2: Rust `engine` module — process spawn, UCI handshake, `analyze_position`

**Files:**
- Modify: `src-tauri/src/engine.rs`

**Interfaces:**
- Consumes: `parse_info_line`, `parse_bestmove_line`, `InfoLine` from Task 1 (same file).
- Produces (used by Task 3): 
  ```rust
  #[derive(Debug, Clone, PartialEq)]
  pub struct EngineAnalysis {
      pub eval_cp: i32,
      pub is_mate: bool,
      pub best_move_uci: String,
      pub pv: Vec<String>,
  }

  #[derive(Debug, Clone, Copy)]
  pub struct EngineOptions {
      pub depth: u32,
      pub movetime_ms: Option<u32>,
  }
  // impl Default for EngineOptions: depth: 16, movetime_ms: Some(2000) (Global Constraints)

  #[derive(Debug, Clone)]
  pub enum EngineError {
      SpawnFailed(String),
      Io(String),
      NoBestMove,
  }
  // impl std::fmt::Display for EngineError

  pub fn analyze_position(
      engine_path: &str,
      fen: &str,
      opts: &EngineOptions,
  ) -> Result<EngineAnalysis, EngineError>
  ```

- [ ] **Step 1: Write the failing test**

Add to the bottom of `src-tauri/src/engine.rs`, in a new test module:

```rust
#[cfg(test)]
mod analyze_tests {
    use super::*;
    use std::process::{Command, Stdio};

    fn stockfish_available() -> bool {
        Command::new("stockfish")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|mut child| {
                let _ = child.kill();
                let _ = child.wait();
                true
            })
            .unwrap_or(false)
    }

    #[test]
    fn analyzes_the_starting_position_with_a_real_stockfish() {
        if !stockfish_available() {
            eprintln!("skipping analyze_position test: stockfish not found on PATH");
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
            result.eval_cp.abs() < 150,
            "expected a roughly balanced startpos eval, got {}",
            result.eval_cp
        );
        assert_eq!(result.best_move_uci.len(), 4);
        assert!(!result.is_mate);
    }

    #[test]
    fn errors_when_the_engine_binary_does_not_exist() {
        let opts = EngineOptions::default();
        let err = analyze_position(
            "definitely-not-a-real-engine-binary",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
            &opts,
        )
        .unwrap_err();
        assert!(matches!(err, EngineError::SpawnFailed(_)));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib engine::analyze_tests 2>&1 | tail -30`
Expected: FAIL — `cannot find type \`EngineOptions\`` / `cannot find function \`analyze_position\`` (compile error).

- [ ] **Step 3: Implement `EngineAnalysis`/`EngineOptions`/`EngineError`/`analyze_position`**

Insert into `src-tauri/src/engine.rs`, above the `#[cfg(test)] mod parse_tests` block:

```rust
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq)]
pub struct EngineAnalysis {
    pub eval_cp: i32,
    pub is_mate: bool,
    pub best_move_uci: String,
    pub pv: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct EngineOptions {
    pub depth: u32,
    pub movetime_ms: Option<u32>,
}

impl Default for EngineOptions {
    fn default() -> Self {
        // OVERVIEW §10.3/§10.4 "Standard Review" defaults (Global Constraints).
        EngineOptions {
            depth: 16,
            movetime_ms: Some(2000),
        }
    }
}

#[derive(Debug, Clone)]
pub enum EngineError {
    SpawnFailed(String),
    Io(String),
    NoBestMove,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::SpawnFailed(msg) => write!(f, "failed to spawn engine: {msg}"),
            EngineError::Io(msg) => write!(f, "engine I/O error: {msg}"),
            EngineError::NoBestMove => write!(f, "engine did not report a best move"),
        }
    }
}

fn write_line(stdin: &mut impl Write, cmd: &str) -> Result<(), EngineError> {
    writeln!(stdin, "{cmd}").map_err(|e| EngineError::Io(e.to_string()))
}

fn wait_for(reader: &mut impl BufRead, token: &str) -> Result<(), EngineError> {
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| EngineError::Io(e.to_string()))?;
        if n == 0 {
            return Err(EngineError::Io(format!(
                "engine closed stdout waiting for {token}"
            )));
        }
        if line.trim_end() == token {
            return Ok(());
        }
    }
}

pub fn analyze_position(
    engine_path: &str,
    fen: &str,
    opts: &EngineOptions,
) -> Result<EngineAnalysis, EngineError> {
    let mut child = Command::new(engine_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| EngineError::SpawnFailed(e.to_string()))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| EngineError::Io("engine process has no stdin".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| EngineError::Io("engine process has no stdout".into()))?;
    let mut reader = BufReader::new(stdout);

    write_line(&mut stdin, "uci")?;
    wait_for(&mut reader, "uciok")?;

    // OVERVIEW §10.4 suggested defaults: Threads = max(1, logical_cpu_count - 1), Hash = 256MB.
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1).max(1))
        .unwrap_or(1);
    write_line(&mut stdin, &format!("setoption name Threads value {threads}"))?;
    write_line(&mut stdin, "setoption name Hash value 256")?;

    write_line(&mut stdin, "isready")?;
    wait_for(&mut reader, "readyok")?;

    write_line(&mut stdin, &format!("position fen {fen}"))?;

    let go_cmd = match opts.movetime_ms {
        Some(ms) => format!("go depth {} movetime {}", opts.depth, ms),
        None => format!("go depth {}", opts.depth),
    };
    write_line(&mut stdin, &go_cmd)?;

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
            let (eval_cp, is_mate) = match (info.score_cp, info.score_mate) {
                (_, Some(mate)) => (if mate >= 0 { 100_000 } else { -100_000 }, true),
                (Some(cp), None) => (cp, false),
                (None, None) => return Err(EngineError::NoBestMove),
            };
            return Ok(EngineAnalysis {
                eval_cp,
                is_mate,
                best_move_uci: best,
                pv: info.pv,
            });
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib engine:: 2>&1 | tail -40`
Expected: `test result: ok. 9 passed; 0 failed` (both new tests pass — `stockfish` is installed on this machine, so the real-engine test runs for real, not skipped; confirm its output doesn't print the "skipping" message).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engine.rs
git commit -m "feat: drive a real Stockfish process over UCI in analyze_position"
```

---

## Task 3: Tauri command `analyze_fen`

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `engine::analyze_position`, `engine::EngineAnalysis`, `engine::EngineOptions`, `engine::EngineError` (Task 2).
- Produces (used by Task 5): Tauri command `analyze_fen(fen: String) -> Result<AnalyzeFenResult, String>`, invokable from JS as `invoke('analyze_fen', { fen })`, returning camelCase JSON: `{ evalCp: number, isMate: boolean, bestMoveUci: string, pv: string[] }`.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `src-tauri/src/lib.rs`:

```rust
#[cfg(test)]
mod analyze_fen_tests {
    use super::*;

    #[test]
    fn analyze_fen_command_delegates_to_the_engine_module() {
        // Calls the plain function the #[tauri::command] macro wraps — no Tauri
        // runtime/App context needed to exercise the delegation itself.
        let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1".to_string();
        match analyze_fen_sync(fen) {
            Ok(result) => {
                assert_eq!(result.best_move_uci.len(), 4);
            }
            Err(msg) => {
                // Only acceptable failure on a machine without stockfish on PATH.
                assert!(msg.contains("failed to spawn engine"), "unexpected error: {msg}");
            }
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib analyze_fen 2>&1 | tail -30`
Expected: FAIL — `cannot find function \`analyze_fen_sync\`` (compile error).

- [ ] **Step 3: Implement the command**

In `src-tauri/src/lib.rs`, add near the top (after `mod engine;`):

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyzeFenResult {
    eval_cp: i32,
    is_mate: bool,
    best_move_uci: String,
    pv: Vec<String>,
}

impl From<engine::EngineAnalysis> for AnalyzeFenResult {
    fn from(a: engine::EngineAnalysis) -> Self {
        AnalyzeFenResult {
            eval_cp: a.eval_cp,
            is_mate: a.is_mate,
            best_move_uci: a.best_move_uci,
            pv: a.pv,
        }
    }
}

/// Plain function the `#[tauri::command]` below wraps — kept separate so it can be
/// unit-tested directly without spinning up a Tauri `App`/`Window` context.
fn analyze_fen_sync(fen: String) -> Result<AnalyzeFenResult, String> {
    engine::analyze_position("stockfish", &fen, &engine::EngineOptions::default())
        .map(AnalyzeFenResult::from)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn analyze_fen(fen: String) -> Result<AnalyzeFenResult, String> {
    // Blocking process I/O — offload to a blocking-friendly task so it doesn't
    // stall the async runtime (Tauri v2 docs: plain `fn` commands run on the main
    // thread; `async fn` + spawn_blocking is the documented pattern for blocking work).
    tauri::async_runtime::spawn_blocking(move || analyze_fen_sync(fen))
        .await
        .map_err(|e| e.to_string())?
}
```

Then register the command in the existing `run()` function's builder chain — modify:

```rust
    tauri::Builder::default()
```

to:

```rust
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![analyze_fen])
```

(placed before `.setup(...)`, matching the order Tauri's own scaffolding docs use).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test 2>&1 | tail -40`
Expected: all tests pass, including `analyze_fen_command_delegates_to_the_engine_module`.

Also run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: expose analyze_fen as a Tauri command"
```

---

## Task 4: TS `notation.ts` — FEN serialization + minimal SAN

**Files:**
- Create: `src/lib/game/notation.ts`
- Test: `src/lib/game/notation.test.ts`

**Interfaces:**
- Consumes: `Move`, `PieceColor`, `Position` types from `$lib/board/types` (existing, unchanged); `MOCK_POSITIONS` from `$lib/game/mock-data` (existing, unchanged — test-only import).
- Produces (used by Task 6): `positionToFen(position: Position, sideToMove: PieceColor, fullmoveNumber: number): string`, `sideToMoveForPly(ply: number): PieceColor`, `fullmoveNumberForPly(ply: number): number`, `moveToSan(position: Position, move: Move): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/notation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
import { MOCK_POSITIONS } from './mock-data';

describe('positionToFen', () => {
	it('serializes the standard starting position', () => {
		expect(positionToFen(MOCK_POSITIONS[0], 'w', 1)).toBe(
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		);
	});

	it('serializes the position after 1.e4 with Black to move', () => {
		expect(positionToFen(MOCK_POSITIONS[1], 'b', 1)).toBe(
			'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1'
		);
	});
});

describe('sideToMoveForPly / fullmoveNumberForPly', () => {
	it('alternates side to move starting with White at ply 0', () => {
		expect(sideToMoveForPly(0)).toBe('w');
		expect(sideToMoveForPly(1)).toBe('b');
		expect(sideToMoveForPly(2)).toBe('w');
	});

	it('increments the fullmove number every two plies', () => {
		expect(fullmoveNumberForPly(0)).toBe(1);
		expect(fullmoveNumberForPly(1)).toBe(1);
		expect(fullmoveNumberForPly(2)).toBe(2);
		expect(fullmoveNumberForPly(3)).toBe(2);
	});
});

describe('moveToSan', () => {
	it('renders a non-capturing bishop move (matches BEST_MOVES[14])', () => {
		expect(moveToSan(MOCK_POSITIONS[13], { from: 'c8', to: 'g4' })).toBe('Bg4');
	});

	it('renders a non-capturing knight move (matches BEST_MOVES[30])', () => {
		expect(moveToSan(MOCK_POSITIONS[29], { from: 'f6', to: 'g4' })).toBe('Ng4');
	});

	it('renders a pawn capture with the from-file prefix', () => {
		// SAN_LIST[21] = 'fxe6': before this move (MOCK_POSITIONS[21]), White's
		// bishop sits on e6 (just played Bxe6) and Black's f7 pawn can recapture.
		expect(moveToSan(MOCK_POSITIONS[21], { from: 'f7', to: 'e6' })).toBe('fxe6');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/game/notation.test.ts`
Expected: FAIL — cannot resolve `./notation` (module doesn't exist yet).

- [ ] **Step 3: Implement `notation.ts`**

Create `src/lib/game/notation.ts`:

```ts
/**
 * Pure move/position notation helpers for the Phase-0 engine spike (LOGIC.md §7).
 * positionToFen intentionally omits castling rights/en-passant (both hardcoded to
 * '-') and the halfmove clock (hardcoded to 0) — the mock Position shape carries
 * none of that state, and full tracking arrives with the real shakmaty-based `pgn`
 * module in a later iteration. moveToSan is a minimal, non-disambiguating SAN
 * approximation used only to label engine best-move suggestions (see this plan's
 * Global Constraints).
 */
import type { Move, PieceColor, Position } from '$lib/board/types';

const FILES = 'abcdefgh';

export function positionToFen(
	position: Position,
	sideToMove: PieceColor,
	fullmoveNumber: number
): string {
	const rows: string[] = [];
	for (let rank = 8; rank >= 1; rank--) {
		let row = '';
		let empty = 0;
		for (let f = 0; f < 8; f++) {
			const piece = position[FILES[f] + rank];
			if (!piece) {
				empty++;
				continue;
			}
			if (empty > 0) {
				row += String(empty);
				empty = 0;
			}
			row += piece[1] === 'w' ? piece[0] : piece[0].toLowerCase();
		}
		if (empty > 0) row += String(empty);
		rows.push(row);
	}
	return `${rows.join('/')} ${sideToMove} - - 0 ${fullmoveNumber}`;
}

export function sideToMoveForPly(ply: number): PieceColor {
	return ply % 2 === 0 ? 'w' : 'b';
}

export function fullmoveNumberForPly(ply: number): number {
	return Math.floor(ply / 2) + 1;
}

export function moveToSan(position: Position, move: Move): string {
	const piece = position[move.from];
	const capture = Boolean(position[move.to]);
	if (!piece || piece[0] === 'P') {
		return capture ? `${move.from[0]}x${move.to}` : move.to;
	}
	return `${piece[0]}${capture ? 'x' : ''}${move.to}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/notation.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/notation.ts src/lib/game/notation.test.ts
git commit -m "feat: add FEN serialization and minimal SAN helpers for the engine spike"
```

---

## Task 5: TS `api/engine.ts` — `analyzeFen` invoke wrapper

**Files:**
- Modify: `src/lib/api/index.ts` (add the re-export)
- Create: `src/lib/api/engine.ts`
- Test: `src/lib/api/engine.test.ts`

**Interfaces:**
- Consumes: `invoke` from `@tauri-apps/api/core` (existing dependency, not yet used elsewhere in this codebase — `api/window.ts` uses `@tauri-apps/api/window` instead).
- Produces (used by Task 6): 
  ```ts
  export interface AnalyzeFenResult {
      evalCp: number;
      isMate: boolean;
      bestMoveUci: string;
      pv: string[];
  }
  export function analyzeFen(fen: string): Promise<AnalyzeFenResult>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/engine.test.ts` (mirrors `src/lib/api/window.test.ts`'s mocking convention):

```ts
import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { analyzeFen } from './engine';

describe('analyzeFen', () => {
	it('invokes the analyze_fen command with the given FEN and returns its result', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: ['e2e4', 'e7e5']
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(invoke).toHaveBeenCalledWith('analyze_fen', {
			fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		});
		expect(result.bestMoveUci).toBe('e2e4');
		expect(result.evalCp).toBe(34);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/engine.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 3: Implement `api/engine.ts`**

Create `src/lib/api/engine.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
}

/** Invokes the Rust `analyze_fen` Tauri command (LOGIC.md §7 Phase-0 spike). */
export function analyzeFen(fen: string): Promise<AnalyzeFenResult> {
	return invoke<AnalyzeFenResult>('analyze_fen', { fen });
}
```

Update `src/lib/api/index.ts` to add the re-export alongside the existing placeholder comment:

```ts
// Tauri invoke wrappers land here starting the iteration that wires the Rust backend
export * from './window';
export * from './engine';
```

(If `src/lib/api/index.ts` does not yet re-export `window.ts`, add that line too — check the file's current contents first and only add what's missing.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/api/engine.test.ts`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/engine.ts src/lib/api/engine.test.ts src/lib/api/index.ts
git commit -m "feat: add analyzeFen Tauri invoke wrapper"
```

---

## Task 6: TS `game/engine-analysis.ts` — real per-ply analysis orchestration

**Files:**
- Create: `src/lib/game/engine-analysis.ts`
- Test: `src/lib/game/engine-analysis.test.ts`

**Interfaces:**
- Consumes: `analyzeFen` + `AnalyzeFenResult` from `$lib/api/engine` (Task 5); `positionToFen`, `sideToMoveForPly`, `fullmoveNumberForPly`, `moveToSan` from `./notation` (Task 4); `MOCK_POSITIONS` from `./mock-data` (existing); `Move` from `$lib/board/types` (existing).
- Produces (used by Task 7): 
  ```ts
  export interface RealAnalysis {
      evalPerPly: number[];
      bestMoves: Record<number, Move & { san: string }>;
  }
  export function loadRealAnalysis(): Promise<RealAnalysis>;
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/engine-analysis.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { analyzeFen } = vi.hoisted(() => ({ analyzeFen: vi.fn() }));
vi.mock('$lib/api/engine', () => ({ analyzeFen }));

import { loadRealAnalysis } from './engine-analysis';
import { MOCK_POSITIONS } from './mock-data';

describe('loadRealAnalysis', () => {
	beforeEach(() => {
		analyzeFen.mockReset();
	});

	it('produces one evalPerPly entry per mock position, normalized to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 50,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: []
		}));

		const { evalPerPly } = await loadRealAnalysis();

		expect(evalPerPly).toHaveLength(MOCK_POSITIONS.length);
		expect(evalPerPly[0]).toBeCloseTo(0.5); // ply 0: White to move, +50cp -> +0.50 White POV
		expect(evalPerPly[1]).toBeCloseTo(-0.5); // ply 1: Black to move, +50cp for Black -> -0.50 White POV
	});

	it('maps each analyzed position\'s best move onto the following ply (matches BEST_MOVES[14] shape)', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis();

		expect(bestMoves[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
	});

	it('does not add a bestMoves entry for the position after the final ply', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis();

		expect(bestMoves[MOCK_POSITIONS.length]).toBeUndefined();
	});

	it('reports a large-magnitude eval for mate scores, sign matching the mover', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: true, bestMoveUci: 'e2e4', pv: [] });

		const { evalPerPly } = await loadRealAnalysis();

		expect(evalPerPly[0]).toBeGreaterThan(50); // ply 0: White to move, mate found -> large positive
		expect(evalPerPly[1]).toBeLessThan(-50); // ply 1: Black to move, mate found -> large negative (White POV)
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/game/engine-analysis.test.ts`
Expected: FAIL — cannot resolve `./engine-analysis`.

- [ ] **Step 3: Implement `engine-analysis.ts`**

Create `src/lib/game/engine-analysis.ts`:

```ts
/**
 * Orchestrates the Phase-0 engine spike: analyzes every ply of the mock Italian
 * Game with the real Stockfish-backed `analyze_fen` command and reshapes the
 * results into the same evalPerPly/bestMoves shape the (now-replaced) mock
 * EVAL_PER_PLY/BEST_MOVES arrays used. classCodes/coachText stay mocked — move
 * classification is out of scope for this iteration (LOGIC.md §7).
 */
import type { Move } from '$lib/board/types';
import { analyzeFen } from '$lib/api/engine';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
import { MOCK_POSITIONS } from './mock-data';

export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
}

/** Stockfish's score is relative to the side to move at the analyzed FEN — flip it
 * to White's POV (positive = good for White) so it matches evalBarPct's convention. */
function toWhitePovEval(evalCp: number, isMate: boolean, sideToMove: 'w' | 'b'): number {
	const moverPov = isMate ? 100 : evalCp / 100;
	return sideToMove === 'w' ? moverPov : -moverPov;
}

export async function loadRealAnalysis(): Promise<RealAnalysis> {
	const results = await Promise.all(
		MOCK_POSITIONS.map((position, ply) =>
			analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
		)
	);

	const evalPerPly = results.map((r, ply) =>
		toWhitePovEval(r.evalCp, r.isMate, sideToMoveForPly(ply))
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
	results.forEach((r, ply) => {
		if (ply === MOCK_POSITIONS.length - 1 || r.bestMoveUci.length < 4) return;
		const from = r.bestMoveUci.slice(0, 2);
		const to = r.bestMoveUci.slice(2, 4);
		bestMoves[ply + 1] = { from, to, san: moveToSan(MOCK_POSITIONS[ply], { from, to }) };
	});

	return { evalPerPly, bestMoves };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/engine-analysis.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine-analysis.ts src/lib/game/engine-analysis.test.ts
git commit -m "feat: orchestrate per-ply real engine analysis for the mock game"
```

---

## Task 7: `appState` — real analysis fields + `startReview` wiring

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `loadRealAnalysis`, `RealAnalysis` from `$lib/game/engine-analysis` (Task 6); `EVAL_PER_PLY`, `BEST_MOVES` from `$lib/game/mock-data` (existing); `Move` from `$lib/board/types` (existing).
- Produces (used by Task 8): `AppState` interface gains `evalPerPly: number[]`, `bestMoves: Record<number, Move & { san: string }>`, `analysisStatus: 'idle' | 'loading' | 'ready' | 'error'`. `startReview()` now also triggers the async real-analysis load (fire-and-forget from the caller's perspective — it awaits internally and updates `appState` in place).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, near the top (after the existing imports), replacing the existing import block with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

import { createAppState } from './app-state.svelte';
import {
	appState,
	MAX_PLY,
	goToPly,
	stepPly,
	startReview,
	newGame,
	handleReviewKeydown
} from './app-state.svelte';
```

Then append a new `describe` block at the end of the file:

```ts
describe('real analysis loading', () => {
	beforeEach(() => {
		loadRealAnalysis.mockReset();
	});

	it('starts in the idle status by default', () => {
		const state = createAppState();
		expect(state.analysisStatus).toBe('idle');
		expect(state.evalPerPly.length).toBeGreaterThan(0);
	});

	it('goes loading -> ready and applies the real data on startReview success', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		startReview();
		expect(appState.analysisStatus).toBe('loading');

		resolveAnalysis({ evalPerPly: [0, 0.3], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('ready');
		expect(appState.evalPerPly).toEqual([0, 0.3]);
	});

	it('goes loading -> error when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `state.analysisStatus` is `undefined`, `startReview` doesn't touch `analysisStatus`.

- [ ] **Step 3: Implement the `appState` changes**

In `src/lib/stores/app-state.svelte.ts`, change the imports at the top from:

```ts
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST } from '$lib/game/mock-data';
```

to:

```ts
import type { Move } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST, EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
```

Update the `AppState` interface, adding three fields:

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
}
```

Update `defaultState`, adding the three fields (seeded from the mock arrays so nothing changes visually before real analysis resolves):

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
	analysisStatus: 'idle'
};
```

Update `startReview` and add `refreshRealAnalysis`:

```ts
/** Reference `startReview` handler: always loads the same mock game — pgnText is cosmetic (Global Constraints). */
export function startReview(): void {
	appState.gameLoaded = true;
	appState.screen = 'review';
	appState.ply = MAX_PLY;
	appState.tab = 'analysis';
	void refreshRealAnalysis();
}

/** Fires the Phase-0 engine spike (LOGIC.md §7): replaces the seeded mock
 * evalPerPly/bestMoves with real Stockfish output once analysis completes. */
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves } = await loadRealAnalysis();
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: all tests pass (existing tests + 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: wire startReview to load real per-ply engine analysis"
```

---

## Task 8: Wire components to real `appState.evalPerPly`/`bestMoves` + minimal loading indicator

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts` (no new tests required — just confirm existing tests still pass unmodified per the Global Constraints backward-compatibility rule; add one new test for the optional-parameter override)
- Modify: `src/lib/components/GameReviewScreen.svelte`
- Modify: `src/lib/components/AnalysisTab.svelte`
- Modify: `src/lib/components/AnalysisTab.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/BottomBar.svelte`
- Modify: `src/lib/components/BottomBar.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `appState.evalPerPly`, `appState.bestMoves`, `appState.analysisStatus` (Task 7).
- Produces: `getReviewPly(ply, evalPerPly?, bestMoves?)` — extended signature, default values preserve current behavior exactly.

- [ ] **Step 1: Write the failing test for `getReviewPly`'s new optional parameters**

Add to `src/lib/game/review.test.ts` (inside the existing `describe('getReviewPly')` block, as a new `it`):

```ts
it('accepts explicit evalPerPly/bestMoves overrides instead of the static mock arrays', () => {
	const r = getReviewPly(1, [0, 99], {});
	expect(r.evalNum).toBe(99);
	expect(r.evalStr).toBe('+99.00');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly` only accepts one argument today (TypeScript error on extra args, or the extra args are silently ignored and the assertion fails against the mock value).

- [ ] **Step 3: Extend `getReviewPly`'s signature**

In `src/lib/game/review.ts`, change:

```ts
export function getReviewPly(ply: number): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMove = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;

	const evalNum = EVAL_PER_PLY[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (BEST_MOVES[ply] ?? null) : null;
```

to:

```ts
export function getReviewPly(
	ply: number,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES
): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMove = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and real/mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;
```

(The function's remaining body is unchanged — `moveNo`/`coachMove`/`coachText`/the return statement stay exactly as they are today.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: all tests pass, including the new one. Every pre-existing `getReviewPly(N)` call in the test file keeps passing unmodified (defaults preserve behavior).

- [ ] **Step 5: Wire `GameReviewScreen.svelte` and `AnalysisTab.svelte` to pass real data through**

In `src/lib/components/GameReviewScreen.svelte`, change:

```ts
const data = $derived(getReviewPly(appState.ply));
```

to:

```ts
const data = $derived(getReviewPly(appState.ply, appState.evalPerPly, appState.bestMoves));
```

In `src/lib/components/AnalysisTab.svelte`, change the imports from:

```ts
import { getReviewPly } from '$lib/game/review';
```

to:

```ts
import { getReviewPly } from '$lib/game/review';
import { appState } from '$lib/stores/app-state.svelte';
```

and change:

```ts
const data = $derived(getReviewPly(ply));
```

to:

```ts
const data = $derived(getReviewPly(ply, appState.evalPerPly, appState.bestMoves));
```

Then add a minimal "Analyzing…" indicator just above the `coach-slot` div in the same file's markup:

```svelte
<div class="analysis-tab">
	{#if appState.analysisStatus === 'loading'}
		<div class="analyzing-note">Analyzing with Stockfish…</div>
	{/if}
	<div class="coach-slot">
```

and add its style, alongside the existing `.coach-slot`/`.actions` rules:

```css
	.analyzing-note {
		flex: none;
		padding: 10px 14px 0;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-tertiary);
	}
```

- [ ] **Step 6: Update `AnalysisTab.test.ts` for the new appState dependency**

`AnalysisTab.svelte` now reads `appState.analysisStatus`/`appState.evalPerPly`/`appState.bestMoves` directly. Add `import { appState } from '$lib/stores/app-state.svelte';` to `src/lib/components/AnalysisTab.test.ts` and add one new test, appended to the existing `describe('AnalysisTab')` block:

```ts
it('shows the analyzing note only while analysisStatus is loading', () => {
	appState.analysisStatus = 'loading';
	const { getByText, unmount } = render(AnalysisTab, {
		props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
	});
	expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
	unmount();

	appState.analysisStatus = 'ready';
	const { queryByText } = render(AnalysisTab, {
		props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
	});
	expect(queryByText('Analyzing with Stockfish…')).toBeNull();
	appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
});
```

- [ ] **Step 7: Run `AnalysisTab` tests to verify they pass**

Run: `pnpm vitest run src/lib/components/AnalysisTab.test.ts`
Expected: all tests pass (existing 3 + 1 new).

- [ ] **Step 8: Add `evalPerPly` prop to `ReviewTab.svelte` and `BottomBar.svelte`**

In `src/lib/components/ReviewTab.svelte`, change:

```ts
import { EVAL_PER_PLY, CLASS_CODES } from '$lib/game/mock-data';
```
```ts
interface Props {
	ply: number;
}

let { ply }: Props = $props();
```
```svelte
<EvalGraph evalPerPly={EVAL_PER_PLY} classCodes={CLASS_CODES} {ply} height={66} />
```

to:

```ts
import { CLASS_CODES } from '$lib/game/mock-data';
```
```ts
interface Props {
	ply: number;
	evalPerPly: number[];
}

let { ply, evalPerPly }: Props = $props();
```
```svelte
<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />
```

Apply the identical change to `src/lib/components/BottomBar.svelte` (same import line, same `Props` field addition, same `EvalGraph` prop change — its `height` prop stays `62`).

- [ ] **Step 9: Wire `ReviewPanel.svelte` to pass `appState.evalPerPly` through**

In `src/lib/components/ReviewPanel.svelte`, change:

```svelte
	{#if appState.tab === 'review'}
		<ReviewTab ply={appState.ply} />
```

to:

```svelte
	{#if appState.tab === 'review'}
		<ReviewTab ply={appState.ply} evalPerPly={appState.evalPerPly} />
```

and change:

```svelte
		<BottomBar
			ply={appState.ply}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(MAX_PLY)}
		/>
```

to:

```svelte
		<BottomBar
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(MAX_PLY)}
		/>
```

- [ ] **Step 10: Update `ReviewTab.test.ts` and `BottomBar.test.ts` for the new required prop**

In `src/lib/components/ReviewTab.test.ts`, add `import { EVAL_PER_PLY } from '$lib/game/mock-data';` and change:

```ts
const { container, getByText } = render(ReviewTab, { props: { ply: 31 } });
```

to:

```ts
const { container, getByText } = render(ReviewTab, {
	props: { ply: 31, evalPerPly: EVAL_PER_PLY }
});
```

In `src/lib/components/BottomBar.test.ts`, add the same import and change:

```ts
const { container } = render(BottomBar, {
	props: { ply: 0, onFirst: () => {}, onPrev: () => {}, onNext: () => {}, onLast: () => {} }
});
```

to:

```ts
const { container } = render(BottomBar, {
	props: {
		ply: 0,
		evalPerPly: EVAL_PER_PLY,
		onFirst: () => {},
		onPrev: () => {},
		onNext: () => {},
		onLast: () => {}
	}
});
```

- [ ] **Step 11: Run the full test suite to verify everything passes together**

Run: `pnpm run test -- --run`
Expected: all test files pass (no regressions in `GameReviewScreen.test.ts`, `ReviewPanel.test.ts`, or any other component that transitively renders these).

- [ ] **Step 12: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts \
  src/lib/components/GameReviewScreen.svelte \
  src/lib/components/AnalysisTab.svelte src/lib/components/AnalysisTab.test.ts \
  src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts \
  src/lib/components/BottomBar.svelte src/lib/components/BottomBar.test.ts \
  src/lib/components/ReviewPanel.svelte
git commit -m "feat: wire the Game Review screen to real per-ply engine analysis"
```

---

## Task 9: Final integration & verification sweep

**Files:** none created — this task runs the full verification suite and fixes anything it finds; any fix commits are additional to this task.

**Interfaces:** none new — this task only verifies Tasks 1-8 integrate cleanly.

- [ ] **Step 1: Full JS/TS test suite**

Run: `pnpm run test -- --run`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Type/lint checks**

Run: `pnpm run check`
Expected: 0 errors (the same pre-existing a11y warnings from prior iterations are fine; no new errors).

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 3: Full Rust test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -40`
Expected: all tests pass (the real-Stockfish test in `engine.rs` should genuinely run, not skip, on this machine — confirm its output does not contain "skipping").

Run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Frontend build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual end-to-end smoke test with the dev server**

Run: `pnpm run tauri dev` (or `pnpm run dev` + open the app shell, whichever this repo's existing dev workflow uses — check `package.json` scripts first)

In the running app: navigate to the Game Review screen (paste-sample → Start Review). Confirm:
- The "Analyzing with Stockfish…" note appears briefly on the Analysis tab, then disappears.
- The eval bar/eval graph show plausible values (not all zero, not identical across every ply).
- Stepping through plies with the arrow keys updates the eval bar smoothly.
- No console errors from `analyze_fen` invocations (open devtools).

Record the outcome (pass/fail + any observations) in the ledger entry for this task — this is a manual check an automated reviewer cannot perform, same as prior iterations' native-build verification steps.

- [ ] **Step 6: Update the ledger**

Append to `.superpowers/sdd/progress.md`:

```
---
Iteration 5 (Rust analyze_fen + Stockfish UCI):
Task 1: complete (...)
...
Final verification sweep: complete (lint/check/test/build all pass; cargo test passes with a real Stockfish 18 binary exercised; manual dev-server smoke test confirmed real eval/best-move data renders on the Game Review screen).
```

(Fill in actual commit ranges per task as they land — this is a template, not literal ledger text to copy verbatim.)

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification sweep for iteration 5"
```

(Skip this step entirely if Steps 1-5 found nothing to fix.)
