# Iteration 10: Special Move Classes (Brilliant / Great / Miss) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `classifyGame` (src/lib/game/classify.ts) produce real `'brilliant'`, `'great'`, and `'miss'` classifications instead of always falling through to the six EP-cutoff classes, per the blueprint's decision tree (docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard:_A_Technical_Design_Implementation_Blueprint.md §4/§8).

**Architecture:** Add Stockfish `MultiPV=2` support to the Rust engine layer (needed only for Great's "only move" gap check), thread the second-PV-line eval/WDL through the existing per-ply pipeline exactly like WDL was threaded in Iteration 9, add a small pure `material.ts` module for sacrifice detection (needed only for Brilliant), and extend `classifyGame` with an optional `special` inputs object so the three new checks run before falling back to the existing EP-cutoff table. Every touched signature keeps its existing optional-parameter backward-compatible pattern (established in Iterations 7 and 9): omitting the new parameter reproduces today's behavior byte-for-byte.

**Tech Stack:** SvelteKit 5 (runes) + TypeScript + Vitest on the frontend; Rust/cargo + a real Stockfish UCI subprocess on the backend.

## Global Constraints

- Every new/changed function parameter is optional and defaults to reproducing today's exact behavior (no `special` argument → `classifyGame` behaves exactly as it does today; no MultiPV#2 from the engine → `secondEvalPerPly`/`secondWdlPerPly` entries are `null` and Great simply never fires for that ply).
- All win/expected-score math stays on the existing 0-100 win% scale this codebase already uses (`winPercentForPly` from `src/lib/game/accuracy.ts`) — do not introduce the blueprint's 0-1 "expected points" scale into TS code.
- Decision order, first match wins: **Brilliant > Great > Miss > EP-cutoff table** (the existing `classifyMoveByEpLoss`). `Book` and `Forced` are explicitly OUT of scope this iteration — do not add a `'forced'` `ClassCode` variant or any opening-book/ECO lookup.
- Threshold constants (blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's win%-points 0-100 scale): `brilliantMinWin = 50`, `brilliantNotWinning = 97`, `greatOnlyMoveGap = 10`, `missWinBefore = 80`, `missWinAfter = 55`. Use these exact numbers.
- No SEE (Static Exchange Evaluation) or search-continuation lookahead for sacrifice detection — a pure material-count diff immediately after the mover's own move is the full extent of "is this a sacrifice" for this iteration (documented simplification, matches this plan's Architecture section).
- All new Rust structs/fields use the same `#[serde(rename_all = "camelCase")]` / naming conventions already used in `src-tauri/src/lib.rs` and `src-tauri/src/engine.rs`.
- Run `cargo test` from `src-tauri/`; run `pnpm exec vitest run` (or `rtk proxy pnpm exec vitest run` if the plain command truncates output — a known issue from prior iterations) from the repo root for the frontend suite.

---

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

### Task 3: Compute `secondEvalPerPly`/`secondWdlPerPly` in `engine-analysis.ts`

**Files:**
- Modify: `src/lib/game/engine-analysis.ts`
- Test: `src/lib/game/engine-analysis.test.ts`

**Interfaces:**
- Consumes: `AnalyzeFenResult.secondEvalCp/secondIsMate/secondWdl` (Task 2).
- Produces: `RealAnalysis.secondEvalPerPly: (number | null)[]`, `RealAnalysis.secondWdlPerPly: (Wdl | null)[]` — both White-POV, same per-ply indexing and flip convention as `evalPerPly`/`wdlPerPly`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/engine-analysis.test.ts` (inside the existing `describe('loadRealAnalysis', ...)`, after the `'reports null wdlPerPly entries...'` test):
```typescript
	it('produces one secondEvalPerPly entry per position, normalized to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 50,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: 20,
			secondIsMate: false,
			secondWdl: null
		}));

		const { secondEvalPerPly } = await loadRealAnalysis(testPositions);

		expect(secondEvalPerPly).toHaveLength(testPositions.length);
		expect(secondEvalPerPly[0]).toBeCloseTo(0.2); // ply 0: White to move, +20cp -> +0.20 White POV
		expect(secondEvalPerPly[1]).toBeCloseTo(-0.2); // ply 1: Black to move, +20cp for Black -> -0.20 White POV
	});

	it('reports a null secondEvalPerPly entry when the engine reported no second PV line', async () => {
		analyzeFen.mockResolvedValue({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: null,
			secondIsMate: false,
			secondWdl: null
		});

		const { secondEvalPerPly } = await loadRealAnalysis(testPositions);

		expect(secondEvalPerPly.every((e) => e === null)).toBe(true);
	});

	it('produces one secondWdlPerPly entry per position, flipped to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: 0,
			secondIsMate: false,
			secondWdl: [600, 300, 100]
		}));

		const { secondWdlPerPly } = await loadRealAnalysis(testPositions);

		expect(secondWdlPerPly[0]).toEqual([600, 300, 100]); // ply 0: White to move, no flip
		expect(secondWdlPerPly[1]).toEqual([100, 300, 600]); // ply 1: Black to move, w/l swap
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: FAIL — `secondEvalPerPly`/`secondWdlPerPly` are `undefined` (not yet produced by `loadRealAnalysis`).

- [ ] **Step 3: Implement**

Current code in `src/lib/game/engine-analysis.ts`:
```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
}
```
Replace with:
```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
}
```

Current code:
```typescript
	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
```
Replace with:
```typescript
	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const secondEvalPerPly = results.map((r, ply) =>
		r.secondEvalCp === null ? null : toWhitePovEval(r.secondEvalCp, sideToMoveForPly(ply))
	);

	const secondWdlPerPly = results.map((r, ply) =>
		r.secondWdl ? toWhitePovWdl(r.secondWdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
```

And the final `return` statement:
```typescript
	return { evalPerPly, bestMoves, wdlPerPly };
```
becomes:
```typescript
	return { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: PASS (all tests in the file, existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine-analysis.ts src/lib/game/engine-analysis.test.ts
git commit -m "feat(engine-analysis): compute White-POV secondEvalPerPly/secondWdlPerPly from the engine's second PV line"
```

---

### Task 4: Pure material-sacrifice detector

**Files:**
- Create: `src/lib/game/material.ts`
- Test: `src/lib/game/material.test.ts`

**Interfaces:**
- Consumes: `Position`, `PieceColor`, `PieceType` (from `$lib/board/types`).
- Produces: `materialForColor(position: Position, color: PieceColor): number`, `isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean` — consumed by Task 5's `classify.ts`.

This is a simplified, no-SEE, no-lookahead sacrifice check (Global Constraints): it measures whether the mover's own move dropped their material lead over the opponent by at least a minor piece's worth (3 points), comparing the position immediately before the move to the position immediately after it (before the opponent has a chance to reply).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/material.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { materialForColor, isMaterialSacrifice } from './material';
import type { Position } from '$lib/board/types';

describe('materialForColor', () => {
	it('sums standard piece values for one side, ignoring the king', () => {
		const position: Position = {
			e1: ['K', 'w'],
			d1: ['Q', 'w'],
			a1: ['R', 'w'],
			h1: ['R', 'w'],
			c1: ['B', 'w'],
			b1: ['N', 'w'],
			a2: ['P', 'w'],
			e8: ['K', 'b']
		};
		// Q(9) + R(5) + R(5) + B(3) + N(3) + P(1) = 26; king contributes 0.
		expect(materialForColor(position, 'w')).toBe(26);
		expect(materialForColor(position, 'b')).toBe(0);
	});

	it('returns 0 for a side with no pieces on the board', () => {
		const position: Position = { e1: ['K', 'w'] };
		expect(materialForColor(position, 'b')).toBe(0);
	});
});

describe('isMaterialSacrifice', () => {
	it('is true when the mover gives up a piece worth 3+ points net, relative to the opponent', () => {
		// White has a knight on e5 that simply vanishes (given away) -- no
		// White capture compensates, and Black's material is unchanged.
		const before: Position = {
			e1: ['K', 'w'],
			e5: ['N', 'w'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(true);
	});

	it('is false for an even trade (capturing a piece of equal value)', () => {
		// White's bishop captures Black's bishop: White's own material is
		// unchanged, Black's material drops by 3 -- the DIFFERENTIAL (mover
		// minus opponent) goes up, not down, so this is not a sacrifice.
		const before: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			f7: ['B', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			f7: ['B', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});

	it('is false for a small material swing under the 3-point sacrifice threshold', () => {
		// White's pawn captures Black's pawn: only a 1-point swing.
		const before: Position = {
			e1: ['K', 'w'],
			d4: ['P', 'w'],
			e5: ['P', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e5: ['P', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/material.test.ts`
Expected: FAIL — `./material` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/game/material.ts`:
```typescript
/**
 * Pure, no-SEE material accounting used only as Brilliant's sacrifice
 * precondition (blueprint §4/§8's `is_piece_sacrifice` guard, simplified:
 * no search-continuation lookahead, just the raw material swing the mover's
 * own move caused, measured immediately before the opponent gets to reply).
 */
import type { Position, PieceColor, PieceType } from '$lib/board/types';

const PIECE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 0
};

/** Sums standard piece values for one side on a board (king excluded, value 0). */
export function materialForColor(position: Position, color: PieceColor): number {
	return Object.values(position)
		.filter(([, pieceColor]) => pieceColor === color)
		.reduce((sum, [type]) => sum + PIECE_VALUES[type], 0);
}

/**
 * True when the mover's own move dropped their material lead over the
 * opponent (their material minus the opponent's) by at least a minor
 * piece's worth (3 points), comparing the position immediately before the
 * move to the position immediately after it. An even or favorable trade
 * (capturing a piece of equal or greater value) does not count -- only a
 * move that gives up material net counts as a sacrifice.
 */
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean {
	const opponent: PieceColor = mover === 'w' ? 'b' : 'w';
	const diffBefore = materialForColor(before, mover) - materialForColor(before, opponent);
	const diffAfter = materialForColor(after, mover) - materialForColor(after, opponent);
	return diffAfter - diffBefore <= -3;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/material.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/material.ts src/lib/game/material.test.ts
git commit -m "feat(material): add a pure material-sacrifice detector for Brilliant classification"
```

---

### Task 5: Extend `classifyGame` with Brilliant/Great/Miss

**Files:**
- Modify: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts` (read this file first with `get_symbols_overview`/`find_symbol` to confirm its exact current test structure and imports before adding to it — it is not reproduced here since it wasn't read during planning; do not guess its existing contents, only append new `describe` blocks that import the same way the file's existing tests do)

**Interfaces:**
- Consumes: `Wdl`, `winPercentForPly` (`./accuracy`); `sideToMoveForPly` (`./notation`); `materialForColor`/`isMaterialSacrifice` (`./material`, Task 4); `Move`, `Position` (`$lib/board/types`); `Move & { san: string }` shape for `bestMoves` (matches `RealAnalysis.bestMoves`, Task 3, and `AppState.bestMoves`).
- Produces: `export interface SpecialClassInputs`; `classifyGame(evalPerPly, wdlPerPly?, special?)` — the `special` param is consumed by Task 6's `app-state.svelte.ts`.

- [ ] **Step 1: Write the failing tests**

First, read the current `src/lib/game/classify.test.ts` in full (via `get_symbols_overview` then `find_symbol` with `include_body=true` on its top-level `describe` blocks) to see its exact existing imports and helper fixtures, so the new tests below match its conventions rather than introducing a second, inconsistent style. Then add a new `describe('classifyGame with special classes', ...)` block whose tests construct minimal `Position`/`Move` fixtures directly (do not invent fixtures that duplicate ones already defined in the file — reuse them if suitable):

```typescript
describe('classifyGame with special classes', () => {
	// 3 plies: ply0 (before any move) -> ply1 (after White's move) -> ply2 (after Black's move).
	// evalPerPly / wdlPerPly are White-POV win% inputs; the fixture positions/moves below are
	// only wired up to exercise the Brilliant/Great/Miss branches, not to represent a legal game.

	it('classifies a best/near-best sound piece sacrifice as brilliant', () => {
		const evalPerPly = [0, 0]; // win% 50 before and after (via the sigmoid) is not what
		// matters here -- use wdlPerPly to pin exact mover-POV win% values instead.
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: White win% 80 (mover POV, White to move)
			[600, 400, 0] // ply 1: White win% 80 after the move (stays >= 50, well under 97)
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e5: ['N', 'w'], e8: ['K', 'b'] }, // before: White has a knight on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after: the knight is gone -- a sacrifice
		];
		const moveMeta: Move[] = [{ from: 'e5', to: 'd7' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd7', san: 'Nd7' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['brilliant']);
	});

	it('classifies an only-move (large MultiPV gap) best move as great', () => {
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[550, 400, 50], // ply 0: White win% (550+200)/10 = 75 (mover POV)
			[550, 400, 50] // ply 1: unchanged -- no sacrifice/miss condition applies
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[350, 400, 250], // ply 0's second PV line: White win% (350+200)/10 = 55 -> gap of 20 >= 10
			null
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e1', to: 'e2', san: 'Ke2' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, {
			positions,
			moveMeta,
			bestMoves,
			secondWdlPerPly
		});

		expect(codes).toEqual(['great']);
	});

	it('classifies a failure to punish a winning position as miss', () => {
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[850, 100, 50], // ply 0: White win% (850+50)/10 = 90 (mover POV, above the 80 miss-before threshold)
			[300, 400, 300] // ply 1: White win% (300+200)/10 = 50 (below the 55 miss-after threshold)
		];
		const evalPerPly = [0, 0];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {}; // played move need not be "best" for Miss

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['miss']);
	});

	it('falls back to the EP-cutoff table when no special condition matches', () => {
		const evalPerPly = [0, -0.6]; // a small eval drop, no WDL provided
		const codes = classifyGame(evalPerPly);
		// No `special` argument at all -- must reproduce today's exact (pre-Task-5) behavior.
		expect(codes).toHaveLength(1);
		expect(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']).toContain(codes[0]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — `classifyGame` doesn't yet accept a third `special` argument (TypeScript type error) and none of Brilliant/Great/Miss are produced.

- [ ] **Step 3: Implement**

Current code in `src/lib/game/classify.ts`:
```typescript
import type { ClassCode } from '$lib/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
```
Replace with:
```typescript
import type { ClassCode } from '$lib/types';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
import { isMaterialSacrifice } from './material';

/** blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's
 * 0-100 win%-points scale (the blueprint's own numbers are on a 0-1 scale). */
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const GREAT_ONLY_MOVE_GAP = 10;
const MISS_WIN_BEFORE = 80;
const MISS_WIN_AFTER = 55;

/**
 * Optional real-game inputs that unlock the Brilliant/Great/Miss special
 * classes (blueprint §4/§8). Omitting this parameter entirely from
 * `classifyGame` reproduces its pre-existing (EP-cutoff-only) behavior
 * byte-for-byte -- every field here is used only to ADD classifications on
 * top of the deterministic cutoff table, never to change it.
 */
export interface SpecialClassInputs {
	/** One board position per ply (same shape/indexing as `GameData.positions`). */
	positions: Position[];
	/** The move actually played to reach ply `i + 1` (same shape as `GameData.moveMeta`). */
	moveMeta: Move[];
	/** The engine's suggested move FROM the position at ply `i - 1` TO reach ply `i`
	 * (same indexing as `RealAnalysis.bestMoves`/`AppState.bestMoves`). */
	bestMoves: Record<number, Move & { san: string }>;
	/** The engine's second-choice (MultiPV #2) win%-relevant data at the position
	 * BEFORE each ply, White-POV, same indexing as `evalPerPly`/`wdlPerPly`. */
	secondEvalPerPly?: (number | null)[];
	secondWdlPerPly?: (Wdl | null)[];
}

function secondLineWinPercent(
	ply: number,
	secondEvalPerPly?: (number | null)[],
	secondWdlPerPly?: (Wdl | null)[]
): number | null {
	const wdl = secondWdlPerPly?.[ply];
	if (wdl) return (wdl[0] + 0.5 * wdl[1]) / 10;
	const evalPawns = secondEvalPerPly?.[ply];
	if (evalPawns === null || evalPawns === undefined) return null;
	return 100 / (1 + Math.exp(-0.00368208 * (evalPawns * 100)));
}
```

Replace `classifyGame`'s body. Current code:
```typescript
export function classifyGame(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		codes.push(classifyMoveByEpLoss(beforePov - afterPov));
	}

	return codes;
}
```
Replace with:
```typescript
export function classifyGame(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	special?: SpecialClassInputs
): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const epLoss = beforePov - afterPov;

		codes.push(classifySpecial(ply, mover, beforePov, afterPov, epLoss, special) ?? classifyMoveByEpLoss(epLoss));
	}

	return codes;
}

/** Brilliant > Great > Miss (blueprint §4 override order, Book/Forced out of
 * scope this iteration). Returns null when no special condition applies and
 * no `special` argument was supplied at all -- falls through to the
 * deterministic EP-cutoff table in either case. */
function classifySpecial(
	ply: number,
	mover: 'w' | 'b',
	beforePov: number,
	afterPov: number,
	epLoss: number,
	special?: SpecialClassInputs
): ClassCode | null {
	if (!special) return null;

	const playedMove = special.moveMeta[ply - 1];
	const suggested = special.bestMoves[ply];
	const playedIsBest = Boolean(
		playedMove && suggested && suggested.from === playedMove.from && suggested.to === playedMove.to
	);
	const nearBest = epLoss <= 2 || playedIsBest;

	if (
		nearBest &&
		special.positions[ply - 1] &&
		special.positions[ply] &&
		isMaterialSacrifice(special.positions[ply - 1], special.positions[ply], mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}

	if (playedIsBest) {
		const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
		if (secondPov !== null) {
			const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
			if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
				return 'great';
			}
		}
	}

	if (beforePov >= MISS_WIN_BEFORE && afterPov < MISS_WIN_AFTER) {
		return 'miss';
	}

	return null;
}
```

Update the module's header doc comment (the block that currently ends with "Book/Brilliant/Great/Miss/Forced are Chess.com's fuzzier, rating-scaled special cases... are intentionally a later iteration") to read:
```
 * Scope note: Brilliant/Great/Miss (this file's `classifySpecial`) run before
 * the deterministic cutoff table, per Chess.com's own override order
 * (Brilliant > Great > Miss > cutoffs). Book and Forced remain a later
 * iteration (opening-book/ECO lookup and a dedicated ClassCode are both out
 * of scope here) -- see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS (all existing tests + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat(classify): add Brilliant/Great/Miss special-class detection ahead of the EP-cutoff table"
```

---

### Task 6: Wire the special-class inputs through `app-state.svelte.ts`

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Test: `src/lib/stores/app-state.test.ts` (exists — read it first with `get_symbols_overview`/`find_symbol` to confirm its exact current assertions on `defaultState`/`startReview`/`refreshRealAnalysis` before editing, since adding two new `AppState` fields may touch an existing "matches the default state shape" style assertion there).

**Interfaces:**
- Consumes: `RealAnalysis.secondEvalPerPly/secondWdlPerPly` (Task 3), `classifyGame(evalPerPly, wdlPerPly?, special?)` (Task 5).
- Produces: `AppState.secondEvalPerPly: (number | null)[]`, `AppState.secondWdlPerPly: (Wdl | null)[]` (both default `[]`, reset in `startReview`, populated in `refreshRealAnalysis`).

- [ ] **Step 1: Add the two fields to `AppState` and `defaultState`**

Current code:
```typescript
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
	classCodes: ClassCode[];
	wdlPerPly: (Wdl | null)[];
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
	game: GameData | null;
	parseError: string | null;
}
```
Add after `wdlPerPly: (Wdl | null)[];`:
```typescript
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
```

Current `defaultState`:
```typescript
	classCodes: [],
	wdlPerPly: [],
	analysisStatus: 'idle',
```
Add after `wdlPerPly: [],`:
```typescript
	secondEvalPerPly: [],
	secondWdlPerPly: [],
```

- [ ] **Step 2: Reset the new fields in `startReview`**

Current code in `startReview`:
```typescript
		appState.classCodes = [];
		appState.wdlPerPly = [];
		appState.analysisStatus = 'idle';
```
Replace with:
```typescript
		appState.classCodes = [];
		appState.wdlPerPly = [];
		appState.secondEvalPerPly = [];
		appState.secondWdlPerPly = [];
		appState.analysisStatus = 'idle';
```

- [ ] **Step 3: Populate the new fields and pass `special` into `classifyGame` in `refreshRealAnalysis`**

Current code:
```typescript
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves, wdlPerPly } = await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly);
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```
Replace with:
```typescript
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly } =
			await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.secondEvalPerPly = secondEvalPerPly;
		appState.secondWdlPerPly = secondWdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly
		});
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```

- [ ] **Step 4: Run the full frontend suite to confirm nothing regressed**

Run: `rtk proxy pnpm exec vitest run`
Expected: PASS (every existing test file, since `AppState`'s new fields are purely additive and every changed call site still provides all required arguments).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts
git commit -m "feat(app-state): thread the engine's second PV line into classifyGame's special-class inputs"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Rust suite**

Run: `cd src-tauri && cargo test`
Expected: PASS, all suites (engine, lib, pgn).

- [ ] **Step 2: Frontend suite**

Run: `cd /home/jonas/Documents/Code/SecondBoard && rtk proxy pnpm exec vitest run`
Expected: PASS, all test files.

- [ ] **Step 3: Type-check, lint, build**

Run:
```bash
pnpm check
pnpm lint
pnpm build
```
Expected: all three clean (no new type errors, no new lint violations, a successful production build).

- [ ] **Step 4: Manual GUI smoke test note**

Deferred to the user (headless sandbox, same as every prior iteration) — load a real game with at least one sacrifice/only-move/missed-win moment and confirm the Breakdown table's Brilliant/Great/Miss rows can now show non-zero counts.

- [ ] **Step 5: Commit (only if Steps 1-3 required any fixes)**

```bash
git add -A
git commit -m "fix: address full-suite verification findings for special move classes"
```
