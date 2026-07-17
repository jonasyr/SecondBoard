# Title Bar Controls + Real Winner/Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three defects the user annotated on a screenshot of the Game Review screen: (1) the title bar's window controls look like decorative macOS dots instead of native Windows caption buttons and sit at the top-left instead of the top-right; (2) the "Local · Offline" status pill must be removed; (3) the Review tab's Accuracy block is 100% hardcoded mock data (`PLAYERS.white/black.accuracy`, a literal `0–1` result, and a green "winner" ring always drawn on Black's avatar) instead of reflecting the actually-loaded game's real result and a real, engine-derived accuracy number.

**Architecture:** Title bar is a pure presentational rework of `TitleBar.svelte` (no new data). Accuracy/winner requires a new backend field (PGN `Result` tag, threaded Rust → `api/pgn.ts` → `GameData` → `appState`) plus a new pure-function module (`src/lib/game/accuracy.ts`) implementing the standard win%-based accuracy estimate (eval → win% sigmoid, per-move win%-loss → accuracy formula, averaged per side), combined in `review.ts` with the existing real-name/mock-fallback pattern, then rendered by a de-mocked `AccuracyBlock.svelte`.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest + @testing-library/svelte, Rust (`pgn-reader`/`shakmaty`) via Tauri commands, `cargo test`.

## Global Constraints

- Follow the repo's real-data-over-mock-fallback pattern exactly as established in `getPlayerRows` (`src/lib/game/review.ts:122-162`): prefer the real value, fall back to `PLAYERS` mock fixture only when the real value is null, and comment why.
- Do not touch move classification, coach text, breakdown table, phase table, or "Game Rating" (est. performance) — those remain out of scope mock data per `design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md` §11/§13 and are not part of the user's annotation.
- The accuracy formula is a **public approximation** of chess.com/lichess-style accuracy (win%-sigmoid + per-move accuracy curve), not chess.com's undisclosed exact algorithm (which additionally volatility-weights the average). Say so in a code comment on `computeGameAccuracy` — do not claim exact parity.
- Every new/changed `.ts`/`.svelte` file gets its test file updated in the same task (TDD: write/adjust the failing test first, then implement).
- Constants for the accuracy formula (do not re-derive, use exactly these):
  - Win% sigmoid: `winPercent(cp) = 100 / (1 + exp(-0.00368208 * cp))` where `cp` is centipawns from White's POV.
  - Per-move accuracy: `moveAccuracy(winPercentLoss) = clamp(103.1668 * exp(-0.04354 * max(0, winPercentLoss)) - 3.1669, 0, 100)`.
- Run `pnpm exec vitest run <file>` after every TS/Svelte task and `cargo test` (from `src-tauri/`) after the Rust task, per `mem:task_completion` (Serena memory) — do not move to the next task with red tests.
- Windows dev machine, Git Bash shell — use the commands exactly as written (they already account for this).

---

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

## Task 2: TS API + store — thread `result` through to `GameData`

**Files:**
- Modify: `src/lib/api/pgn.ts`
- Modify: `src/lib/game/review.ts` (only the `GameData` interface, lines 19-28)
- Modify: `src/lib/stores/app-state.svelte.ts` (only the `startReview` object literal, lines 77-86)
- Modify: `src/lib/game/review.test.ts` (fixture objects, add `result: null` to `sampleGame`/`notSampleGame`)
- Test: `src/lib/stores/app-state.test.ts` (add one new test)

**Interfaces:**
- Consumes: `pgn::ParsedGame.result: Option<String>` from Task 1 (deserializes as `string | null` via Tauri's `invoke`).
- Produces: `GameData.result: string | null` — consumed by Task 4's `getAccuracySummary`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/stores/app-state.test.ts`, in the same `describe` block as the other `startReview` tests (follow the existing pattern at the file's PGN-parsing tests, using the same `parsePgn.mockResolvedValue`/`loadRealAnalysis.mockResolvedValue` setup already used there):

```typescript
	it('threads the parsed Result tag into game.result', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }],
			result: '1-0'
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBe('1-0');
	});

	it('defaults game.result to null when the PGN has no Result tag', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBeNull();
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.game!.result` is `undefined`, not `'1-0'`/`null` (property doesn't exist yet on the assigned object; TypeScript would also fail `pnpm check` at this point, which is expected mid-task).

- [ ] **Step 3: Add `result` to `ParsedGame`, `GameData`, and the `startReview` assignment**

In `src/lib/api/pgn.ts`, modify `ParsedGame`:

```typescript
export interface ParsedGame {
	sanList: string[];
	positions: Position[];
	moves: Move[];
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/game/review.ts`, modify `GameData`:

```typescript
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/stores/app-state.svelte.ts`, modify the object literal inside `startReview`:

```typescript
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim(),
			whiteName: parsed.whiteName,
			blackName: parsed.blackName,
			whiteRating: parsed.whiteRating,
			blackRating: parsed.blackRating,
			result: parsed.result ?? null
		};
```

- [ ] **Step 4: Fix now-broken `GameData` fixtures**

In `src/lib/game/review.test.ts`, add `result: null` to both `sampleGame` (after `blackRating: null,` around line 24) and `notSampleGame` (after `blackRating: null,` around line 38), and to the `realGame` spread-fixture inside the `'uses real PGN White/Black/*Elo tags...'` test — since it uses `...notSampleGame`, it inherits `result: null` automatically and needs no direct edit.

Also check `src/lib/components/AnalysisTab.test.ts`'s `appState.game = {...}` fixture (lines 21-30) and add `result: null` after `blackRating: null,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/AnalysisTab.test.ts`
Expected: PASS — all green.

Run: `pnpm check`
Expected: no new TypeScript errors (the `ParsedGame`/`GameData` shapes now agree end-to-end).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/pgn.ts src/lib/game/review.ts src/lib/stores/app-state.svelte.ts src/lib/game/review.test.ts src/lib/stores/app-state.test.ts src/lib/components/AnalysisTab.test.ts
git commit -m "feat: thread the PGN Result tag into GameData.result"
```

---

## Task 3: `src/lib/game/accuracy.ts` — win%, per-move accuracy, game accuracy, winner

**Files:**
- Create: `src/lib/game/accuracy.ts`
- Test: `src/lib/game/accuracy.test.ts`

**Interfaces:**
- Consumes: `PieceColor` from `$lib/board/types`; `sideToMoveForPly` from `./notation` (`sideToMoveForPly(ply: number): PieceColor`, returns `'w'` for even `ply`, `'b'` for odd — `src/lib/game/notation.ts:40-42`).
- Produces:
  - `winPercentFromEval(evalPawns: number): number` — White's win% (0-100).
  - `computeGameAccuracy(evalPerPly: number[]): { white: number | null; black: number | null }` — consumed by Task 4.
  - `resolveWinner(result: string | null): 'white' | 'black' | 'draw' | null` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/accuracy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { winPercentFromEval, computeGameAccuracy, resolveWinner } from './accuracy';

describe('winPercentFromEval', () => {
	it('is exactly 50 at a dead-even eval', () => {
		expect(winPercentFromEval(0)).toBe(50);
	});

	it('is symmetric: White POV win% for +N and -N sum to 100', () => {
		expect(winPercentFromEval(1) + winPercentFromEval(-1)).toBeCloseTo(100, 9);
		expect(winPercentFromEval(5) + winPercentFromEval(-5)).toBeCloseTo(100, 9);
	});

	it('is monotonically increasing in eval', () => {
		expect(winPercentFromEval(1)).toBeGreaterThan(winPercentFromEval(0));
		expect(winPercentFromEval(5)).toBeGreaterThan(winPercentFromEval(1));
	});

	it('saturates towards 100 for a large mate-magnitude eval (does not overflow to NaN)', () => {
		expect(winPercentFromEval(1000)).toBeCloseTo(100, 5);
		expect(Number.isNaN(winPercentFromEval(-1000))).toBe(false);
		expect(winPercentFromEval(-1000)).toBeCloseTo(0, 5);
	});

	it('matches the exact spec value at +1 pawn', () => {
		expect(winPercentFromEval(1)).toBeCloseTo(59.102589719161294, 9);
	});
});

describe('computeGameAccuracy', () => {
	it('returns null for both sides when there are fewer than 2 eval samples', () => {
		expect(computeGameAccuracy([0])).toEqual({ white: null, black: null });
		expect(computeGameAccuracy([])).toEqual({ white: null, black: null });
	});

	it('gives ~perfect accuracy to both sides when the eval never worsens for the mover', () => {
		// ply0 (start, eval 0) -> ply1 white moves to +1.0 (good for White) ->
		// ply2 black moves to +0.5 (good for Black, since it's an improvement
		// for Black relative to +1.0).
		const { white, black } = computeGameAccuracy([0, 1, 0.5]);
		expect(white).toBeCloseTo(99.9999, 4);
		expect(black).toBeCloseTo(99.9999, 4);
	});

	it('penalizes a mover whose eval swings against them, and averages across that side\'s moves', () => {
		// White plays two moves that each worsen White's eval (0 -> -3, -3.2 -> -8);
		// Black plays two moves that each slightly improve Black's eval (-3 -> -3.2, -8 -> -8.5).
		const { white, black } = computeGameAccuracy([0, -3, -3.2, -8, -8.5]);
		expect(white).toBeCloseTo(37.126083891942, 6);
		expect(black).toBeCloseTo(99.9999, 4);
	});
});

describe('resolveWinner', () => {
	it('resolves the standard PGN Result tags', () => {
		expect(resolveWinner('1-0')).toBe('white');
		expect(resolveWinner('0-1')).toBe('black');
		expect(resolveWinner('1/2-1/2')).toBe('draw');
	});

	it('returns null for a missing or unrecognized result', () => {
		expect(resolveWinner(null)).toBeNull();
		expect(resolveWinner('*')).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL — `Cannot find module './accuracy'`.

- [ ] **Step 3: Implement `src/lib/game/accuracy.ts`**

```typescript
/**
 * Real per-side game accuracy and winner, replacing the mocked
 * PLAYERS.white/black.accuracy fixture and hardcoded "0–1" result
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §12 "Accuracy
 * System"). This is the standard public win%-sigmoid approximation used by
 * lichess/chess.com-style accuracy estimators, NOT chess.com's undisclosed
 * exact algorithm (which additionally volatility-weights the average rather
 * than taking a simple mean) — treat the output as a close estimate, not a
 * byte-for-byte match.
 */
import type { PieceColor } from '$lib/board/types';
import { sideToMoveForPly } from './notation';

/** OVERVIEW §11.5's expected_score sigmoid, tuned with the constant commonly
 * used by public lichess/chess.com accuracy-estimate implementations.
 * `evalPawns` is White-POV, as produced by engine-analysis.ts's evalPerPly. */
export function winPercentFromEval(evalPawns: number): number {
	const cp = evalPawns * 100;
	return 100 / (1 + Math.exp(-0.00368208 * cp));
}

/** Converts one move's win%-loss (from the mover's own POV) into a 0-100
 * per-move accuracy score. A move that doesn't worsen the mover's win% at
 * all (loss <= 0) scores ~100; accuracy decays smoothly as the loss grows. */
function moveAccuracy(winPercentLoss: number): number {
	const loss = Math.max(0, winPercentLoss);
	const acc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
	return Math.min(100, Math.max(0, acc));
}

export interface GameAccuracy {
	white: number | null;
	black: number | null;
}

/**
 * Derives per-side game accuracy from the real Stockfish evalPerPly
 * (White-POV pawns, one entry per ply including the starting position) that
 * engine-analysis.ts's loadRealAnalysis() produces. Each ply transition's
 * mover is scored by how much their own win% dropped from before their move
 * to after it; a side's game accuracy is the mean of its own moves' scores.
 * Returns null for a side (or both) when there isn't enough data yet (e.g.
 * analysis hasn't completed) rather than a misleading number.
 */
export function computeGameAccuracy(evalPerPly: number[]): GameAccuracy {
	if (evalPerPly.length < 2) return { white: null, black: null };

	const whiteScores: number[] = [];
	const blackScores: number[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover: PieceColor = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercentFromEval(evalPerPly[ply - 1]);
		const afterWhitePov = winPercentFromEval(evalPerPly[ply]);
		const moverBefore = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const moverAfter = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const score = moveAccuracy(moverBefore - moverAfter);
		(mover === 'w' ? whiteScores : blackScores).push(score);
	}

	const mean = (xs: number[]): number | null =>
		xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null;

	return { white: mean(whiteScores), black: mean(blackScores) };
}

export type Winner = 'white' | 'black' | 'draw' | null;

/** Resolves the PGN `Result` tag (`'1-0'` / `'0-1'` / `'1/2-1/2'`) into a
 * winner. Any other value (missing tag, `'*'` = ongoing/unknown) is null. */
export function resolveWinner(result: string | null): Winner {
	if (result === '1-0') return 'white';
	if (result === '0-1') return 'black';
	if (result === '1/2-1/2') return 'draw';
	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat: add real win%-based game accuracy and winner resolution"
```

---

## Task 4: `review.ts` — `getAccuracySummary` (real data + mock-name fallback)

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `GameData.result`/`whiteName`/`blackName` (Task 2); `computeGameAccuracy`/`resolveWinner` from `./accuracy` (Task 3); existing `PLAYERS` from `./mock-data`.
- Produces: `AccuracySummary` and `getAccuracySummary(game: GameData, evalPerPly: number[]): AccuracySummary` — consumed by Task 6 (`ReviewTab.svelte`).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/game/review.test.ts` (new `describe` block at the end of the file, after the existing `getPlayerRows` block):

```typescript
describe('getAccuracySummary', () => {
	it('falls back to the mock PLAYERS names when the PGN has no name tags, and resolves the real winner', () => {
		const game: GameData = { ...sampleGame, result: '0-1' };
		const summary = getAccuracySummary(game, [0, 1, 0.5]);

		expect(summary.white.name).toBe('Jonas');
		expect(summary.black.name).toBe('DominikP');
		expect(summary.white.isWinner).toBe(false);
		expect(summary.black.isWinner).toBe(true);
		expect(summary.resultLabel).toBe('0–1');
	});

	it('uses real PGN names when present', () => {
		const game: GameData = {
			...notSampleGame,
			whiteName: 'Donald Byrne',
			blackName: 'Robert James Fischer',
			result: '1-0'
		};
		const summary = getAccuracySummary(game, [0, 1]);

		expect(summary.white.name).toBe('Donald Byrne');
		expect(summary.white.initial).toBe('D');
		expect(summary.black.name).toBe('Robert James Fischer');
		expect(summary.black.initial).toBe('R');
		expect(summary.white.isWinner).toBe(true);
		expect(summary.black.isWinner).toBe(false);
	});

	it('reports accuracy as null (not a fabricated number) when there is not enough eval data yet', () => {
		const game: GameData = { ...sampleGame, result: null };
		const summary = getAccuracySummary(game, [0]);

		expect(summary.white.accuracy).toBeNull();
		expect(summary.black.accuracy).toBeNull();
		expect(summary.resultLabel).toBe('—');
	});

	it('formats a draw result and marks neither side as the winner', () => {
		const game: GameData = { ...sampleGame, result: '1/2-1/2' };
		const summary = getAccuracySummary(game, [0, 0]);

		expect(summary.resultLabel).toBe('½–½');
		expect(summary.white.isWinner).toBe(false);
		expect(summary.black.isWinner).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getAccuracySummary is not a function` (not exported yet).

- [ ] **Step 3: Implement `getAccuracySummary` in `src/lib/game/review.ts`**

Add the import (extend the existing `./mock-data` import line and add the new `./accuracy` import) — modify line 17:

```typescript
import { BEST_MOVES, COACH_TEXT_MAP, EVAL_PER_PLY, CLASS_CODES, PLAYERS } from './mock-data';
import { computeGameAccuracy, resolveWinner } from './accuracy';
```

Append to the end of `src/lib/game/review.ts` (after `getPlayerRows`):

```typescript
export interface AccuracySide {
	name: string;
	initial: string;
	accuracy: string | null;
	isWinner: boolean;
}

export interface AccuracySummary {
	white: AccuracySide;
	black: AccuracySide;
	resultLabel: string;
}

function formatResultLabel(result: string | null): string {
	if (result === '1-0') return '1–0';
	if (result === '0-1') return '0–1';
	if (result === '1/2-1/2') return '½–½';
	return '—';
}

/**
 * Derives the Accuracy block's real winner + accuracy numbers (OVERVIEW §12
 * Accuracy System) from the loaded game's PGN Result tag and real Stockfish
 * evalPerPly. Player name/initial follow the same real-PGN-over-mock-PLAYERS
 * fallback as getPlayerRows. Accuracy is null (rendered as "—" by
 * AccuracyBlock) rather than a mock number when there isn't enough eval data
 * yet (analysis still loading, or a game with too few plies).
 */
export function getAccuracySummary(game: GameData, evalPerPly: number[]): AccuracySummary {
	const whiteName = game.whiteName ?? PLAYERS.white.name;
	const blackName = game.blackName ?? PLAYERS.black.name;
	const { white, black } = computeGameAccuracy(evalPerPly);
	const winner = resolveWinner(game.result);

	return {
		white: {
			name: whiteName,
			initial: whiteName.charAt(0).toUpperCase(),
			accuracy: white === null ? null : white.toFixed(1),
			isWinner: winner === 'white'
		},
		black: {
			name: blackName,
			initial: blackName.charAt(0).toUpperCase(),
			accuracy: black === null ? null : black.toFixed(1),
			isWinner: winner === 'black'
		},
		resultLabel: formatResultLabel(game.result)
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: derive real winner/accuracy summary in getAccuracySummary"
```

---

## Task 5: `AccuracyBlock.svelte` — render real winner + accuracy

**Files:**
- Modify: `src/lib/components/AccuracyBlock.svelte`
- Modify: `src/lib/components/AccuracyBlock.test.ts`

**Interfaces:**
- Consumes: `AccuracySide`/`AccuracySummary` shape from Task 4 (`{ name, initial, accuracy, isWinner }` per side, `resultLabel: string`), passed in as props by Task 6.
- Produces: same visual chip/avatar/result layout, now data-driven; `Game Rating` row is intentionally left as-is (still reads mock `PLAYERS.white/black.gameRating` — out of scope per this plan's Global Constraints).

- [ ] **Step 1: Write the failing test**

Replace `src/lib/components/AccuracyBlock.test.ts` entirely:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AccuracyBlock from './AccuracyBlock.svelte';

const white = { name: 'Donald Byrne', initial: 'D', accuracy: '82.6', isWinner: false };
const black = { name: 'Robert Fischer', initial: 'R', accuracy: '89.1', isWinner: true };

describe('AccuracyBlock', () => {
	it('renders both players\' real names, accuracy, and the real result label', () => {
		const { getByText } = render(AccuracyBlock, {
			props: { white, black, resultLabel: '0–1' }
		});
		expect(getByText('Donald Byrne')).toBeTruthy();
		expect(getByText('Robert Fischer')).toBeTruthy();
		expect(getByText('82.6')).toBeTruthy();
		expect(getByText('89.1')).toBeTruthy();
		expect(getByText('0–1')).toBeTruthy();
	});

	it('renders "—" instead of a fabricated number when accuracy is null', () => {
		const { getAllByText } = render(AccuracyBlock, {
			props: {
				white: { ...white, accuracy: null },
				black: { ...black, accuracy: null },
				resultLabel: '—'
			}
		});
		expect(getAllByText('—')).toHaveLength(3); // white chip + black chip + result
	});

	it('highlights the real winner\'s avatar/chip, not always Black', () => {
		const { container } = render(AccuracyBlock, {
			props: { white: { ...white, isWinner: true }, black: { ...black, isWinner: false }, resultLabel: '1-0' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(true);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
	});

	it('tints neither side on a draw', () => {
		const { container } = render(AccuracyBlock, {
			props: { white, black: { ...black, isWinner: false }, resultLabel: '½–½' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/AccuracyBlock.test.ts`
Expected: FAIL — component still renders the hardcoded `PLAYERS`/`0–1` mock, none of the new props are read, `getByText('Donald Byrne')` etc. throw not-found.

- [ ] **Step 3: Rewrite `AccuracyBlock.svelte`**

```svelte
<script lang="ts">
	import { PLAYERS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import type { AccuracySide } from '$lib/game/review';

	interface Props {
		white: AccuracySide;
		black: AccuracySide;
		resultLabel: string;
	}

	let { white, black, resultLabel }: Props = $props();
</script>

<div class="accuracy-grid">
	<div class="col">
		<span class="name">{white.name}</span>
		<div
			class="avatar"
			class:neutral={!white.isWinner}
			class:tinted={white.isWinner}
			style={`background:${TOKENS.review.avatarWhiteBg};`}
		>
			{white.initial}
		</div>
		<div class="chip sbmono" class:neutral={!white.isWinner} class:tinted={white.isWinner}>
			{white.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
	<span class="result sbmono">{resultLabel}</span>
	<div class="col">
		<span class="name">{black.name}</span>
		<div
			class="avatar"
			class:neutral={!black.isWinner}
			class:tinted={black.isWinner}
			style={`background:${TOKENS.review.avatarBlackBg};`}
		>
			{black.initial}
		</div>
		<div class="chip sbmono" class:neutral={!black.isWinner} class:tinted={black.isWinner}>
			{black.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
</div>

<div class="rating-row">
	<div>
		<div class="rating-title">Game Rating</div>
		<div class="rating-subtitle">Est. performance</div>
	</div>
	<div class="rating-col"><div class="chip neutral sbmono wide">{PLAYERS.white.gameRating}</div></div>
	<span></span>
	<div class="rating-col"><div class="chip tinted sbmono wide">{PLAYERS.black.gameRating}</div></div>
</div>

<style>
	.accuracy-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 10px;
		margin-bottom: 16px;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.name {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-text-primary-alt);
	}
	.avatar {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-inset);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 19px;
	}
	.avatar.neutral {
		color: var(--color-card-bg);
		border: 2px solid rgba(255, 255, 255, 0.12);
	}
	.avatar.tinted {
		color: var(--color-text-secondary);
		border: 2px solid var(--color-accent-green);
		box-shadow: 0 0 0 3px rgba(74, 222, 160, 0.16);
	}
	.chip {
		width: 100%;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		border-radius: 8px;
		padding: 5px 0;
	}
	.chip.neutral {
		color: var(--color-text-primary-alt);
		background: #181a24;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.chip.tinted {
		color: var(--color-light-green-1);
		background: rgba(74, 222, 160, 0.06);
		border: 1px solid rgba(74, 222, 160, 0.4);
	}
	.chip.wide {
		width: auto;
		min-width: 72px;
	}
	.label {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		letter-spacing: 0.03em;
	}
	.result {
		font-size: 12px;
		color: var(--color-text-tertiary);
	}
	.rating-row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 12px 0;
		border-top: 1px solid var(--color-hairline-high);
		border-bottom: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
	.rating-title {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}
	.rating-subtitle {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		margin-top: 1px;
	}
	.rating-col {
		display: flex;
		justify-content: center;
	}
</style>
```

Note: the White avatar's background color never changes (it stays `TOKENS.review.avatarWhiteBg` regardless of who won) — only the `.tinted`/`.neutral` class (driven by `isWinner`) controls the border/glow ring, matching the original design's avatar-color-is-fixed-per-side visual. Keep `PLAYERS` imported only for the still-mock `gameRating` row.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/AccuracyBlock.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AccuracyBlock.svelte src/lib/components/AccuracyBlock.test.ts
git commit -m "feat: wire AccuracyBlock to the real winner and accuracy summary"
```

---

## Task 6: `ReviewTab.svelte` — wire the real summary in

**Files:**
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`

**Interfaces:**
- Consumes: `appState` (`$lib/stores/app-state.svelte`, already has `game: GameData | null` per `mem:core`); `getAccuracySummary` from `$lib/game/review` (Task 4).

- [ ] **Step 1: Update the failing test**

Replace `src/lib/components/ReviewTab.test.ts` entirely (adds an `appState.game` fixture, following the exact pattern already used in `src/lib/components/AnalysisTab.test.ts:20-31`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';
import { EVAL_PER_PLY } from '$lib/game/mock-data';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.game = {
		sanList: ['e4'],
		positions: [{}, {}],
		moveMeta: [{ from: 'e2', to: 'e4' }],
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: '0-1'
	};
});

describe('ReviewTab', () => {
	it('renders the eval graph, accuracy block, breakdown, and phase table together', () => {
		const { container, getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});

	it('shows the real winner (from game.result) in the accuracy block, not a hardcoded one', () => {
		const { getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(getByText('0–1')).toBeTruthy();
	});

	it('shows no analyzing overlay by default', () => {
		const { queryByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(false);
	});

	it('shows a centered analyzing overlay over the blurred graph when analyzing is true', () => {
		const { getByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, analyzing: true }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Expected: FAIL — `AccuracyBlock` (as of Task 5) now requires `white`/`black`/`resultLabel` props that `ReviewTab.svelte` doesn't pass yet; Svelte will throw/warn on missing required props and `getByText('0–1')` won't be found.

- [ ] **Step 3: Wire `getAccuracySummary` into `ReviewTab.svelte`**

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { CLASS_CODES } from '$lib/game/mock-data';
	import { getAccuracySummary } from '$lib/game/review';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, analyzing = false }: Props = $props();

	const accuracy = $derived(getAccuracySummary(appState.game!, evalPerPly));
</script>

<div class="review-tab sbscroll">
	<div class="graph-slot">
		<div class="graph-blur" class:analyzing>
			<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />
		</div>
		{#if analyzing}
			<div class="analyzing-overlay"><span>Analyzing with Stockfish…</span></div>
		{/if}
	</div>
	<AccuracyBlock white={accuracy.white} black={accuracy.black} resultLabel={accuracy.resultLabel} />
	<div class="divider"></div>
	<BreakdownTable />
	<PhaseTable />
</div>
```

(The `<style>` block is unchanged — leave it exactly as it is in the current file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Expected: PASS — all green.

Run full suite to confirm nothing else broke: `pnpm exec vitest run`
Expected: PASS across the repo.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts
git commit -m "feat: render the real accuracy/winner summary in ReviewTab"
```

---

## Task 7: `TitleBar.svelte` — native-looking controls, moved top-right; remove the "Local · Offline" pill

**Files:**
- Modify: `src/lib/components/TitleBar.svelte`
- Modify: `src/lib/components/TitleBar.test.ts`

**Interfaces:**
- Consumes: `minimizeWindow`/`toggleMaximizeWindow`/`closeWindow` from `$lib/api/window` (unchanged, already real — `src/lib/api/window.ts`).
- Produces: same title bar, restyled; no new props/exports.

- [ ] **Step 1: Update the failing test**

Replace `src/lib/components/TitleBar.test.ts` entirely:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TitleBar from './TitleBar.svelte';

const { minimizeWindow, toggleMaximizeWindow, closeWindow } = vi.hoisted(() => ({
	minimizeWindow: vi.fn(),
	toggleMaximizeWindow: vi.fn(),
	closeWindow: vi.fn()
}));

vi.mock('$lib/api/window', () => ({ minimizeWindow, toggleMaximizeWindow, closeWindow }));

describe('TitleBar', () => {
	it('renders the window title text', () => {
		const { getByText } = render(TitleBar);
		expect(getByText('SecondBoard — Local Chess Review Companion')).toBeTruthy();
	});

	it('does not render the "Local · Offline" pill anymore, but keeps the version string', () => {
		const { queryByText, getByText } = render(TitleBar);
		expect(queryByText('Local · Offline')).toBeNull();
		expect(getByText('v0.4.1')).toBeTruthy();
	});

	it('renders the window controls after the version string, at the trailing edge of the bar', () => {
		const { getByTitle, getByText, container } = render(TitleBar);
		const right = container.querySelector('.right')!;
		const version = getByText('v0.4.1');
		const controls = getByTitle('Close').closest('.window-controls')!;
		expect(right.contains(version)).toBe(true);
		expect(right.contains(controls)).toBe(true);
		// version must precede the controls (controls are the trailing/right-most element).
		const position = version.compareDocumentPosition(controls);
		expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('calls minimizeWindow when the minimize button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Minimize'));
		expect(minimizeWindow).toHaveBeenCalledOnce();
	});

	it('calls toggleMaximizeWindow when the maximize button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Maximize'));
		expect(toggleMaximizeWindow).toHaveBeenCalledOnce();
	});

	it('calls closeWindow when the close button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Close'));
		expect(closeWindow).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`
Expected: FAIL — `'Local · Offline'` is still rendered (`queryByText` finds it, so `toBeNull()` fails), and `.window-controls` is still at the top-left before the title, so the trailing-position assertion fails too.

- [ ] **Step 3: Rewrite `TitleBar.svelte`**

```svelte
<script lang="ts">
	import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '$lib/api/window';
</script>

<div class="title-bar" data-tauri-drag-region>
	<div class="title" data-tauri-drag-region>SecondBoard — Local Chess Review Companion</div>
	<div class="right">
		<span class="version sbmono">v0.4.1</span>
		<div class="window-controls">
			<button
				type="button"
				class="win-btn"
				onclick={minimizeWindow}
				title="Minimize"
				aria-label="Minimize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn"
				onclick={toggleMaximizeWindow}
				title="Maximize"
				aria-label="Maximize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn close"
				onclick={closeWindow}
				title="Close"
				aria-label="Close window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1" />
					<line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	.title-bar {
		height: var(--layout-titlebar-height);
		flex: none;
		display: flex;
		align-items: center;
		padding: 0 0 0 14px;
		background: var(--color-titlebar-gradient);
		border-bottom: 1px solid var(--color-hairline-low);
		gap: 14px;
		/* Windows/webview drag-region shim per Tauri's window-customization guide. */
		app-region: drag;
	}
	.title {
		flex: 1;
		text-align: center;
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		font-weight: 500;
	}
	.right {
		display: flex;
		align-items: center;
		align-self: stretch;
		gap: 12px;
		app-region: no-drag;
	}
	.version {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
	}
	.window-controls {
		display: flex;
		align-items: stretch;
		align-self: stretch;
	}
	.win-btn {
		width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}
	.win-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary-alt);
	}
	.win-btn.close:hover {
		background: #e81123;
		color: #ffffff;
	}
</style>
```

Key changes from the original:
- The three decorative `.dot` buttons (left-aligned, colored circles) are replaced with `.win-btn` buttons (right-aligned inside `.window-controls`, full title-bar height via `align-self: stretch`, thin single-line minimize/maximize/close glyphs) — matching native Windows caption-button conventions (rectangular hit target, hover fill, red hover on close) instead of macOS-style dots.
- `.window-controls` moved from being the title bar's first child to the last child inside `.right`, after the version string, so it sits flush at the top-right corner.
- `.status-pill`/`.status-dot`/`.status-text` styles and the `<div class="status-pill">...Local · Offline...</div>` markup are deleted entirely.
- `.title-bar`'s `padding` changed from `0 14px` to `0 0 0 14px` (no right padding) so `.win-btn`'s own right-edge hit area reaches the true corner, matching native caption buttons — `.title`/`.right`'s `gap: 14px` on the flex row still keeps the title and version visually inset from the left edge.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`
Expected: PASS — all green.

Run full suite: `pnpm exec vitest run`
Expected: PASS across the repo (this component isn't imported with props by anything else, so no ripple).

Run: `pnpm check` and `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TitleBar.svelte src/lib/components/TitleBar.test.ts
git commit -m "fix(titlebar): native-style window controls at top-right, drop Local/Offline pill"
```

---

## Task 8: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite one more time**

Run: `pnpm exec vitest run`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run the Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS, 0 failures.

- [ ] **Step 3: Run typecheck and lint**

Run: `pnpm check`
Run: `pnpm lint`
Expected: both clean.

- [ ] **Step 4: Launch the real app and visually confirm all three fixes**

Run: `pnpm exec tauri dev`

Confirm, against the built-in sample game (real result `0-1`, i.e. Black/DominikP won):
1. Title bar: no colored dots at top-left; native-looking rectangular minimize/restore/close buttons sit flush at the top-right, after the `v0.4.1` version text; hovering Close turns it red.
2. No "Local · Offline" pill anywhere in the title bar.
3. Review tab's Accuracy block: Black's avatar/chip carries the winner ring/tint (matches the real `0-1` result), White's does not; the two accuracy numbers are no longer the static `82.6`/`89.1` — confirm they change if a different PGN is pasted (paste any other legal PGN with a `[Result "1-0"]` tag via "New PGN" and confirm White's side is now highlighted instead).

Report any visual mismatch as a follow-up fix — do not silently accept a mismatch.
