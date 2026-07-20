# WDL-Based Expected Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing real-engine pipeline prefer Stockfish's own WDL (win/draw/loss) model over the current centipawn sigmoid for computing win probability, per ply, whenever the engine actually reports it — the engine-version-stable alternative the research blueprint recommends (§3.2, evidence rows 14-16) — while falling back to the exact existing sigmoid behavior whenever WDL isn't available, so nothing regresses.

**Architecture:** Stockfish's `UCI_ShowWDL` option is enabled in the Rust engine transport (`engine.rs`) and its `wdl w d l` output is parsed and threaded, unmodified, all the way to the Tauri boundary (`lib.rs`) as an `Option<(u32, u32, u32)>` (`null` when absent). On the TypeScript side, a single new pure function (`winPercentForPly`, in `accuracy.ts`) becomes the one place that decides "WDL if present, else the sigmoid" — both `computeGameAccuracy` and `classifyGame` are refactored to call it instead of `winPercentFromEval` directly, via a new *optional* `wdlPerPly` parameter that defaults to the current, unmodified behavior when omitted. The array itself is produced by `loadRealAnalysis` (mirroring how `evalPerPly` is already produced there) and threaded through `appState` exactly the way `classCodes` was threaded through in the prior iteration.

**Tech Stack:** Rust (`cargo test`) for the engine transport; SvelteKit 5 + TypeScript + Vitest for everything else. Reuses `PieceColor` from `$lib/board/types` and `sideToMoveForPly` from `./notation`.

## Global Constraints

- WDL values are per-mille (`w + d + l = 1000`) from the **side-to-move's own POV** as Stockfish reports them — this plan fixes ONE canonical convention for all TypeScript-side storage: **White's POV**, exactly like `evalPerPly` is already White-POV pawns. Any WDL value crossing from Rust (side-to-move POV) into the White-POV convention must be flipped exactly once, in `engine-analysis.ts`, the same layer that already flips `evalCp` via `toWhitePovEval`.
- `winPercentFromWdl(wdl) = (w + 0.5*d) / 10` (per-mille â†' percent: `/1000*100 = /10`). Do not use a different formula or re-derive a new constant.
- Every existing exported function whose signature changes (`computeGameAccuracy`, `classifyGame`, `getAccuracySummary`) gains its new parameter as **optional**, defaulting to behavior byte-for-byte identical to today — every existing test in `accuracy.test.ts`, `classify.test.ts`, `review.test.ts`, and `app-state.test.ts` must keep passing unmodified (do not edit those files' existing test bodies in this plan; only add new tests).
- Out of scope for this iteration (do not implement): MultiPV, engine result caching, cancellation, Brilliant/Great/Miss/Book/Forced classification, the Chess.com comparison/calibration harness, and any change to the EP-cutoff table or the accuracy aggregation formulas themselves — only the win% *input* to those formulas changes, per ply, when WDL is available.
- Follow the repo's established real-data-over-fallback pattern and doc-comment style (see `src/lib/game/accuracy.ts`, `src/lib/game/classify.ts`, `src/lib/game/review.ts` for house style).
- Run `cargo test` (from `src-tauri/`) after every Rust task, and `pnpm exec vitest run <file>` after every TS task. Run the full verification suite (`cargo test`, `pnpm exec vitest run`, `pnpm check`, `pnpm lint`, `pnpm build`) in the final task. If a plain `pnpm exec vitest run` truncates or garbles its output on this machine (a known issue from the prior iteration, caused by an RTK wrapper), prefix it with `rtk proxy` to get the untruncated summary — don't treat truncated/garbled output as a real failure without confirming via that fallback.

---

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

## Task 3: TS `api/engine.ts` — thread `wdl` into the frontend's `AnalyzeFenResult`

**Files:**
- Modify: `src/lib/api/engine.ts`
- Modify: `src/lib/api/engine.test.ts`

**Interfaces:**
- Produces: `AnalyzeFenResult.wdl: [number, number, number] | null` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Modify `src/lib/api/engine.test.ts` — add `wdl` to the mocked `invoke` resolution and assert it round-trips:

```typescript
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
			pv: ['e2e4', 'e7e5'],
			wdl: [500, 400, 100]
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(invoke).toHaveBeenCalledWith('analyze_fen', {
			fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		});
		expect(result.bestMoveUci).toBe('e2e4');
		expect(result.evalCp).toBe(34);
		expect(result.wdl).toEqual([500, 400, 100]);
	});

	it('passes through a null wdl when the engine did not report one', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(result.wdl).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/api/engine.test.ts`
Expected: FAIL — `result.wdl` is `undefined`, not `[500, 400, 100]`/`null` (TypeScript would also flag the missing interface field, though `vitest` alone will just fail the runtime assertion).

- [ ] **Step 3: Add `wdl` to `AnalyzeFenResult`**

In `src/lib/api/engine.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
	wdl: [number, number, number] | null;
}

/** Invokes the Rust `analyze_fen` Tauri command (LOGIC.md §7 Phase-0 spike). */
export function analyzeFen(fen: string): Promise<AnalyzeFenResult> {
	return invoke<AnalyzeFenResult>('analyze_fen', { fen });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/api/engine.test.ts`
Expected: PASS — both tests green.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/engine.ts src/lib/api/engine.test.ts
git commit -m "feat: thread the engine's WDL field into AnalyzeFenResult"
```

---

## Task 4: `accuracy.ts` — `Wdl` type, `winPercentFromWdl`, and the `winPercentForPly` preference helper

**Files:**
- Modify: `src/lib/game/accuracy.ts`
- Modify: `src/lib/game/accuracy.test.ts`

**Interfaces:**
- Produces:
  - `Wdl = readonly [number, number, number]` (White-POV per-mille win/draw/loss) — consumed by Tasks 5, 6, 7.
  - `winPercentFromWdl(wdl: Wdl): number` — consumed internally and by Task 5.
  - `winPercentForPly(ply: number, evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): number` — consumed by Task 5 (`classifyGame`) and internally by `computeGameAccuracy`.
  - `computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy` — new optional 2nd parameter, consumed by Task 7 (`getAccuracySummary`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/accuracy.test.ts`, right after the existing `winPercentFromEval` describe block:

```typescript
describe('winPercentFromWdl', () => {
	it('matches the blueprint\'s own worked example: wdl 500 400 100 -> 70', () => {
		expect(winPercentFromWdl([500, 400, 100])).toBe(70);
	});

	it('is 100 for a certain win and 0 for a certain loss', () => {
		expect(winPercentFromWdl([1000, 0, 0])).toBe(100);
		expect(winPercentFromWdl([0, 0, 1000])).toBe(0);
	});

	it('is 50 for a certain draw', () => {
		expect(winPercentFromWdl([0, 1000, 0])).toBe(50);
	});
});

describe('winPercentForPly', () => {
	it('prefers the WDL-derived win% when a real entry is present for this ply', () => {
		const evalPerPly = [0, 1];
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], null];
		expect(winPercentForPly(0, evalPerPly, wdlPerPly)).toBe(70);
	});

	it('falls back to the eval sigmoid when wdlPerPly has no entry for this ply', () => {
		const evalPerPly = [0, 1];
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], null];
		expect(winPercentForPly(1, evalPerPly, wdlPerPly)).toBeCloseTo(winPercentFromEval(1), 9);
	});

	it('falls back to the eval sigmoid when wdlPerPly is omitted entirely', () => {
		const evalPerPly = [0, 1];
		expect(winPercentForPly(0, evalPerPly)).toBe(winPercentFromEval(0));
		expect(winPercentForPly(1, evalPerPly)).toBeCloseTo(winPercentFromEval(1), 9);
	});
});

describe('computeGameAccuracy with WDL', () => {
	it('produces the exact same result as before when wdlPerPly is omitted (no regression)', () => {
		// Locks in the pre-existing exact value from this file's own
		// "penalizes a mover..." test above -- passing no wdlPerPly must not
		// change a single digit of the output.
		const { white, black } = computeGameAccuracy([0, -3, -3.2, -8, -8.5]);
		expect(white).toBeCloseTo(37.3255159268525, 9);
		expect(black).toBe(100);
	});

	it('uses the WDL-derived win% for a ply that has one, changing the result vs. eval-only', () => {
		const evalPerPly = [0, -3];
		const withoutWdl = computeGameAccuracy(evalPerPly);
		// A wdl reporting White as far more lost than the eval sigmoid implies
		// (eval -3 pawns alone) should pull White's accuracy down further.
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], [0, 0, 1000]];
		const withWdl = computeGameAccuracy(evalPerPly, wdlPerPly);
		expect(withWdl.white).not.toBeCloseTo(withoutWdl.white!, 6);
		expect(withWdl.white!).toBeLessThan(withoutWdl.white!);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL — `winPercentFromWdl`/`winPercentForPly` are not exported (`Cannot find module` style errors from the named imports), and `computeGameAccuracy` ignores a 2nd argument entirely so the WDL-vs-no-WDL comparison test fails.

- [ ] **Step 3: Implement in `src/lib/game/accuracy.ts`**

Add the import line update at the top of the test file (already covered by Step 1's `describe` blocks referencing these names — the test file's existing `import { winPercentFromEval, computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';` line needs `winPercentFromWdl, winPercentForPly` added):

```typescript
import { winPercentFromEval, winPercentFromWdl, winPercentForPly, computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';
```

In `src/lib/game/accuracy.ts`, add right after `winPercentFromEval`'s definition:

```typescript
/** Win/draw/loss per-mille (`w + d + l = 1000`), always stored White-POV in
 * this codebase — exactly like `evalPerPly` is White-POV pawns — so every
 * consumer applies the same mover-POV flip (`mover === 'w' ? x : 100 - x`)
 * uniformly regardless of whether a given ply's win% came from WDL or the
 * eval sigmoid. Raw engine WDL is side-to-move POV; engine-analysis.ts's
 * `toWhitePovWdl` is the one place that converts. */
export type Wdl = readonly [w: number, d: number, l: number];

/** Stockfish's own WDL model, converted to a White-POV win percentage
 * (blueprint §3.2: `ExpScore = (w + 0.5*d)/1000`, expressed here on the
 * 0-100 scale to match `winPercentFromEval`'s scale exactly). */
export function winPercentFromWdl(wdl: Wdl): number {
	return (wdl[0] + 0.5 * wdl[1]) / 10;
}

/** The one place that decides "WDL if the engine reported it for this ply,
 * else the eval sigmoid" -- both `computeGameAccuracy` and `classify.ts`'s
 * `classifyGame` call this instead of `winPercentFromEval` directly, so a
 * future ply-level data source only needs to be taught to this function
 * once. `wdlPerPly` is optional and index-aligned with `evalPerPly`; when
 * omitted, or when this ply's entry is missing/null, behavior is identical
 * to calling `winPercentFromEval` directly (byte-for-byte, existing
 * behavior is fully preserved for engine builds/positions without WDL). */
export function winPercentForPly(
	ply: number,
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): number {
	const wdl = wdlPerPly?.[ply];
	return wdl ? winPercentFromWdl(wdl) : winPercentFromEval(evalPerPly[ply]);
}
```

Modify `computeGameAccuracy`'s signature and its `winPercents` derivation (the rest of the function body is unchanged):

```typescript
export function computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy {
	const plyCount = evalPerPly.length;
	if (plyCount < 2) return { white: null, black: null };

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const moveCount = plyCount - 1;
	const windowSize = Math.min(8, Math.max(2, Math.floor(moveCount / 10)));
	// ... (rest of function body unchanged from here)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (confirming the no-`wdlPerPly` regression lock holds).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat: prefer WDL-derived win%% over the eval sigmoid when the engine reports it"
```

---

## Task 5: `classify.ts` — same WDL preference for move classification

**Files:**
- Modify: `src/lib/game/classify.ts`
- Modify: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: `Wdl`, `winPercentForPly` from `./accuracy` (Task 4).
- Produces: `classifyGame(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): ClassCode[]` — new optional 2nd parameter, consumed by Task 7 (`app-state.svelte.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/classify.test.ts`, at the end of the `describe('classifyGame', ...)` block:

```typescript
	it('produces the exact same classifications as before when wdlPerPly is omitted (no regression)', () => {
		expect(classifyGame([0, 1, 0.5])).toEqual(['best', 'best']);
		expect(classifyGame([0, -8])).toEqual(['blunder']);
	});

	it('uses the WDL-derived win% for a ply that has one, changing the classification vs. eval-only', () => {
		// eval swing alone (0 -> -0.3) would classify as a small loss (good/excellent);
		// a wdl showing White going from a clear edge to lost changes the verdict.
		const evalPerPly = [0, -0.3];
		const withoutWdl = classifyGame(evalPerPly);
		const wdlPerPly: Array<[number, number, number] | null> = [[600, 300, 100], [0, 0, 1000]];
		const withWdl = classifyGame(evalPerPly, wdlPerPly);
		expect(withoutWdl[0]).not.toBe('blunder');
		expect(withWdl[0]).toBe('blunder');
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — `classifyGame` ignores a 2nd argument entirely, so the WDL-vs-no-WDL comparison test fails (both come out identical).

- [ ] **Step 3: Implement in `src/lib/game/classify.ts`**

Replace the import line:

```typescript
import type { ClassCode } from '$lib/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
```

Replace `classifyGame`'s signature and body:

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

Also update this file's header doc comment (currently says `import { winPercentFromEval } from './accuracy'` in its prose) — replace the phrase "since that's the scale `winPercentFromEval` (accuracy.ts, itself an exact port of lichess's sigmoid) already produces — reusing it keeps the eval math consistent" with "since that's the scale `winPercentForPly` (accuracy.ts) already produces, whether from the eval sigmoid or Stockfish's own WDL model — reusing it keeps the win-probability math consistent" so the comment doesn't go stale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (confirming the no-`wdlPerPly` regression lock holds).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat: classifyGame prefers WDL-derived win%% over the eval sigmoid when available"
```

---

## Task 6: `engine-analysis.ts` — produce `wdlPerPly` (White-POV) from real analysis

**Files:**
- Modify: `src/lib/game/engine-analysis.ts`
- Modify: `src/lib/game/engine-analysis.test.ts`

**Interfaces:**
- Consumes: `AnalyzeFenResult.wdl: [number, number, number] | null` (Task 3); `Wdl` type from `./accuracy` (Task 4).
- Produces: `RealAnalysis.wdlPerPly: (Wdl | null)[]` — consumed by Task 7 (`app-state.svelte.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/engine-analysis.test.ts`, at the end of the `describe('loadRealAnalysis', ...)` block:

```typescript
	it('produces one wdlPerPly entry per position, flipped to White POV', async () => {
		analyzeFen.mockImplementation(async (fen: string) => ({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: [600, 300, 100] // side-to-move POV, favorable for whoever is to move
		}));

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly).toHaveLength(testPositions.length);
		expect(wdlPerPly[0]).toEqual([600, 300, 100]); // ply 0: White to move, so no flip
		expect(wdlPerPly[1]).toEqual([100, 300, 600]); // ply 1: Black to move, so w/l swap to White POV
	});

	it('reports null wdlPerPly entries for positions where the engine did not report wdl', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'e2e4', pv: [], wdl: null });

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly.every((w) => w === null)).toBe(true);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: FAIL — `wdlPerPly` is `undefined` on the returned object (property doesn't exist yet).

- [ ] **Step 3: Implement in `src/lib/game/engine-analysis.ts`**

Replace the top-of-file imports:

```typescript
import type { Move, Position, PieceColor } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { analyzeFen } from '$lib/api/engine';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
```

Update `RealAnalysis`:

```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
}
```

Add a new pure helper right after the existing `toWhitePovEval` function:

```typescript
/** Stockfish's WDL is relative to the side to move at the analyzed FEN, exactly
 * like its cp score -- flip win/loss (draw is symmetric) to White's POV so it
 * matches `evalPerPly`'s convention and can be indexed identically. */
function toWhitePovWdl(wdl: [number, number, number], sideToMove: PieceColor): Wdl {
	return sideToMove === 'w' ? wdl : [wdl[2], wdl[1], wdl[0]];
}
```

Modify `loadRealAnalysis`'s body to compute and return `wdlPerPly`:

```typescript
export async function loadRealAnalysis(positions: Position[]): Promise<RealAnalysis> {
	const results = await mapWithConcurrency(positions, ANALYSIS_CONCURRENCY, (position, ply) =>
		analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
	);

	const evalPerPly = results.map((r, ply) =>
		toWhitePovEval(r.evalCp, sideToMoveForPly(ply))
	);

	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
	results.forEach((r, ply) => {
		if (ply === positions.length - 1 || r.bestMoveUci.length < 4) return;
		const from = r.bestMoveUci.slice(0, 2);
		const to = r.bestMoveUci.slice(2, 4);
		bestMoves[ply + 1] = { from, to, san: moveToSan(positions[ply], { from, to }) };
	});

	return { evalPerPly, bestMoves, wdlPerPly };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (the existing mocked `analyzeFen` results in those tests never include a `wdl` field, so `r.wdl` is `undefined`, which is falsy — every pre-existing test's `wdlPerPly` comes back all-`null` automatically, with zero changes needed to those tests' bodies).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine-analysis.ts src/lib/game/engine-analysis.test.ts
git commit -m "feat: loadRealAnalysis produces White-POV wdlPerPly alongside evalPerPly"
```

---

## Task 7: `app-state.svelte.ts` + `review.ts` + `ReviewTab.svelte`/`ReviewPanel.svelte` — thread `wdlPerPly` end-to-end

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `RealAnalysis.wdlPerPly` (Task 6); `classifyGame(evalPerPly, wdlPerPly?)` (Task 5); `computeGameAccuracy(evalPerPly, wdlPerPly?)` (Task 4); `Wdl` type (Task 4).
- Produces: `AppState.wdlPerPly: (Wdl | null)[]`; `getAccuracySummary(game, evalPerPly, wdlPerPly?)` — 3rd parameter.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, inside the existing `describe('real analysis loading', ...)` block, right after the `'populates classCodes from the real evalPerPly once analysis is ready'` test:

```typescript
	it('populates wdlPerPly from real analysis once it is ready, and resets it to [] on a fresh parse', async () => {
		let resolveAnalysis!: (v: {
			evalPerPly: number[];
			bestMoves: Record<number, never>;
			wdlPerPly: Array<[number, number, number] | null>;
		}) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.wdlPerPly).toEqual([]);

		resolveAnalysis({ evalPerPly: [0, 1], bestMoves: {}, wdlPerPly: [[500, 400, 100], null] });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.wdlPerPly).toEqual([[500, 400, 100], null]);
	});
```

Add to `src/lib/game/review.test.ts`, at the end of the `describe('getAccuracySummary', ...)` block:

```typescript
	it('accepts an optional wdlPerPly and passes it through to computeGameAccuracy without changing the no-wdl result', () => {
		const game: GameData = { ...sampleGame, result: '0-1' };
		const withoutWdl = getAccuracySummary(game, [0, -3]);
		const withWdl = getAccuracySummary(game, [0, -3], [
			[500, 400, 100],
			[0, 0, 1000]
		]);
		expect(withWdl.white.accuracy).not.toBe(withoutWdl.white.accuracy);
	});
```

Add to `src/lib/components/ReviewTab.test.ts`, add a `wdlPerPly: []` prop to every existing `render(ReviewTab, { props: { ... } })` call in the file (there are 5), then add a new test at the end of the `describe('ReviewTab', ...)` block:

```typescript
	it('gates wdlPerPly on analysisStatus === ready, same as evalPerPly, so no fabricated accuracy uses stale wdl', () => {
		appState.analysisStatus = 'loading';
		const { container } = render(ReviewTab, {
			props: { ply: 1, evalPerPly: new Array(2).fill(0), classCodes: [], wdlPerPly: [[500, 400, 100], null] }
		});
		const chips = container.querySelectorAll('.accuracy-grid .chip.sbmono');
		expect(chips.length).toBe(2);
		chips.forEach((chip) => expect(chip.textContent?.trim()).toBe('—'));
		appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts`
Expected: FAIL — `appState.wdlPerPly` is `undefined`; `getAccuracySummary` ignores a 3rd argument; `ReviewTab`'s `Props` doesn't declare `wdlPerPly` yet so passing it does nothing and the gating test can't pass.

- [ ] **Step 3: Wire `wdlPerPly` into `app-state.svelte.ts`**

Modify the top-of-file imports:

```typescript
import type { Move } from '$lib/board/types';
import type { Screen, Tab, ClassCode } from '$lib/types';
import type { Wdl } from '$lib/game/accuracy';
import { EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
import { parsePgn } from '$lib/api/pgn';
import { classifyGame } from '$lib/game/classify';
import { SAMPLE_PGN } from '$lib/game/sample-pgn';
import type { GameData } from '$lib/game/review';
```

Modify `AppState` — add after `classCodes`:

```typescript
	bestMoves: Record<number, Move & { san: string }>;
	classCodes: ClassCode[];
	wdlPerPly: (Wdl | null)[];
```

Modify `defaultState` — add after `classCodes: [],`:

```typescript
	bestMoves: { ...BEST_MOVES },
	classCodes: [],
	wdlPerPly: [],
```

In `startReview`, reset `wdlPerPly` alongside `classCodes`:

```typescript
			appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
			appState.bestMoves = {};
			appState.classCodes = [];
			appState.wdlPerPly = [];
```

In `refreshRealAnalysis`, populate `wdlPerPly` and pass it into `classifyGame`:

```typescript
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
```

- [ ] **Step 4: Wire `wdlPerPly` into `getAccuracySummary` (`review.ts`)**

Modify the `./accuracy` import line:

```typescript
import { computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';
import type { Wdl } from './accuracy';
```

Modify `getAccuracySummary`'s signature and its `computeGameAccuracy` call:

```typescript
export function getAccuracySummary(
	game: GameData,
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): AccuracySummary {
	const whiteName = game.whiteName ?? PLAYERS.white.name;
	const blackName = game.blackName ?? PLAYERS.black.name;
	const { white, black } = computeGameAccuracy(evalPerPly, wdlPerPly);
	const winner = resolveWinner(game.result);
	// ... (rest of function body unchanged from here)
```

- [ ] **Step 5: Wire `wdlPerPly` into `ReviewTab.svelte` and `ReviewPanel.svelte`**

Modify `src/lib/components/ReviewTab.svelte`'s `<script>` block:

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import type { Wdl } from '$lib/game/accuracy';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		wdlPerPly: (Wdl | null)[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, wdlPerPly, analyzing = false }: Props = $props();

	// Only feed the real evalPerPly/wdlPerPly in once analysis has actually
	// finished; otherwise (idle/loading/error) pass empty arrays so
	// computeGameAccuracy's own length<2 guard returns null/null, rendering
	// "—" instead of a fabricated number from the seeded all-zero placeholder
	// evalPerPly that startReview() writes before real analysis completes.
	const accuracy = $derived(
		getAccuracySummary(
			appState.game!,
			appState.analysisStatus === 'ready' ? evalPerPly : [],
			appState.analysisStatus === 'ready' ? wdlPerPly : []
		)
	);
</script>
```

(The rest of `ReviewTab.svelte` — the template and `<style>` block — is unchanged.)

Modify the `<ReviewTab ... />` call in `src/lib/components/ReviewPanel.svelte`:

```svelte
	<ReviewTab
		ply={appState.ply}
		evalPerPly={appState.evalPerPly}
		classCodes={appState.classCodes}
		wdlPerPly={appState.wdlPerPly}
		analyzing={appState.analysisStatus === 'loading'}
	/>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts`
Expected: PASS — all tests green.

Run full suite: `pnpm exec vitest run` (or `rtk proxy pnpm exec vitest run` if the plain command truncates on this machine)
Expected: PASS across the repo.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts src/lib/game/review.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts src/lib/components/ReviewPanel.svelte
git commit -m "feat: thread real wdlPerPly through appState into accuracy and classification"
```

---

## Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS, 0 failures (real-engine WDL tests self-skip with a message if Stockfish isn't on `PATH`, matching the existing pattern for other real-engine tests in this repo).

- [ ] **Step 2: Run the full frontend test suite**

Run: `pnpm exec vitest run` (or `rtk proxy pnpm exec vitest run` if the plain command truncates/garbles output on this machine)
Expected: PASS, 0 failures.

- [ ] **Step 3: Run typecheck, lint, and build**

Run: `pnpm check`
Run: `pnpm lint`
Run: `pnpm build`
Expected: all clean/succeed. In particular, confirm no unused-import lint errors from any file whose imports changed in this plan (`classify.ts`'s `winPercentFromEval` import was replaced with `winPercentForPly`, etc.).

- [ ] **Step 4: Launch the real app and visually confirm**

Run: `pnpm exec tauri dev`

Confirm, against the built-in sample game once analysis finishes:
1. The Review tab's Accuracy block still renders real, non-"—" numbers for both sides (WDL should make them at least as accurate as before, not break the display).
2. No regression in the move list / eval graph / coach card from the prior iteration's move-classification work — this iteration only changes the *input* to the same formulas, not their consumers.

Report any visual mismatch as a follow-up fix — do not silently accept a mismatch.
