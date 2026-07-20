# Value-Aware Special Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SecondBoard classify the Byrne–Fischer reference game with exactly Fischer's three Brilliant moves (`11...Na4`, `15...Nxc3`, `17...Be6`) and one Great move (`19...Ne2+`) while keeping production classification game-independent.

**Architecture:** Extend the pure attack-geometry module with attacker-square discovery and recursive value-aware static exchange evaluation (SEE). Keep WDL expected scores for accuracy, ordinary classes, near-best loss, and Miss, while `classifyGame` computes a second centipawn-sigmoid track exclusively for Brilliant/Great gates and prefers centipawn data for the second-line gap. Freeze the complete reference game's runtime analysis inputs in a test-only JSON fixture and assert exact labels and no extras.

**Tech Stack:** SvelteKit 5, TypeScript 6, Vitest 4, Rust/Tauri, Stockfish (fixture capture and final manual confirmation only).

## Global Constraints

- Production code must contain no player names, SAN labels, reference-game ply exceptions, or fixture lookup tables.
- Standard exchange values are exactly `P=1`, `N=3`, `B=3`, `R=5`, `Q=9`; king targets are excluded and kings use a high internal capture value.
- SEE is intentionally geometric: no full legal-move generation, pin validation, check validation, or king-safety validation.
- Brilliant requires: best move or WDL expected-point loss `<= 2`; a mover-owned non-pawn piece worth at least `3` with opponent SEE gain `> 0` (anywhere on the board, after the move); centipawn score after `>= 50`; centipawn score before `< 80`; and causal evidence that THIS move created the exposure -- the moved piece's own opponent-SEE-gain must have increased across the move (`from` before vs. `to` after), or, if that's absent, the played move is the engine's best move with a best-vs-second centipawn gap `>= 20`. (Amended during Task 3's full-game golden-fixture pass: the original `< 97` ceiling and un-gated exchange-target check fired on persistent sacrifices and continuations inside an already-overwhelming position; see `classify.reference-game.test.ts` and `classify.ts`'s `sacrificeIsCausal`.)
- Great requires: played move equals Stockfish best move; the mover has no positive post-move exchange target (so a rejected/failed sacrifice cannot also register as Great); centipawn pre-move score `< 99`; best-versus-second centipawn gap `>= 15`, with second-line WDL used only when second-line centipawn data is absent. (Gap amended from `20` to `15` and the no-exchange-target guard added during the same Task 3 recalibration.)
- WDL remains authoritative for ordinary expected-point loss, near-best tolerance, accuracy compatibility, and Miss.
- `classifyGame` and `SpecialClassInputs` public signatures remain unchanged.
- The golden fixture is test-only and production modules must not import it.
- Do not add an external chess library.
- Design reference: `docs/superpowers/specs/2026-07-20-value-aware-special-classification-design.md`.

## File Structure

- Modify `src/lib/game/attacks.ts`: expose attacker squares, recursive SEE, and the all-piece sacrifice predicate; retain `countAttackers` and `isPieceHanging` compatibility exports.
- Modify `src/lib/game/attacks.test.ts`: specify SEE material arithmetic, x-rays, input immutability, invalid targets, and the all-piece scan.
- Modify `src/lib/game/classify.ts`: add the centipawn-only score track and feed value-aware sacrifice/CP values into the existing override order.
- Modify `src/lib/game/classify.test.ts`: cover dual score semantics, CP-first second-line selection, WDL fallback, and override behavior.
- Create `src/lib/game/fixtures/byrne-fischer-analysis.json`: complete frozen positions, moves, primary eval/WDL, second eval/WDL, and best moves from one application-equivalent analysis pass.
- Rewrite `src/lib/game/classify.reference-game.test.ts`: focused real Black-ply assertions plus exact full-game golden acceptance.
- Temporarily modify, then restore, `src-tauri/src/lib.rs`: capture the golden JSON using the same PGN parser, FEN shape, engine defaults, and POV conversion as the application.

---

### Task 1: Value-aware static exchange evaluation

**Files:**
- Modify: `src/lib/game/attacks.ts`
- Modify: `src/lib/game/attacks.test.ts`

**Interfaces:**
- Consumes: `Position`, `Piece`, `PieceColor`, `PieceType`, and `Square` from `$lib/board/types`.
- Produces: `findAttackers(position: Position, target: Square, byColor: PieceColor): Square[]`.
- Produces: `staticExchangeGain(position: Position, target: Square, byColor: PieceColor): number`.
- Produces: `hasPositiveExchangeTarget(position: Position, ownerColor: PieceColor, minimumPieceValue?: number): boolean` for Task 2.
- Preserves: `countAttackers(...)` and `isPieceHanging(...)` so existing callers/tests do not break during the transition.

- [ ] **Step 1: Add failing attacker-location and SEE tests**

Replace the import in `src/lib/game/attacks.test.ts` and append the new suites:

```typescript
import {
	countAttackers,
	findAttackers,
	hasPositiveExchangeTarget,
	isPieceHanging,
	staticExchangeGain
} from './attacks';

describe('findAttackers', () => {
	it('returns the attacking squares and preserves blocked rays', () => {
		const position: Position = {
			e1: ['K', 'w'],
			b5: ['N', 'b'],
			a4: ['R', 'b'],
			a2: ['P', 'w'],
			e8: ['K', 'b']
		};
		expect(findAttackers(position, 'd4', 'b')).toEqual(['b5']);
		expect(findAttackers(position, 'a1', 'b')).toEqual([]);
	});
});

describe('staticExchangeGain', () => {
	it('returns the value of an undefended capturable piece', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			b5: ['N', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'b5', 'w')).toBe(3);
	});

	it('values queen-for-bishop after a pawn recapture as +6', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c5: ['B', 'w'],
			b6: ['Q', 'b'],
			a7: ['P', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'b6', 'w')).toBe(6);
	});

	it('allows the initiating side to stop at zero after an equal recapture', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			b5: ['B', 'b'],
			a6: ['P', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'b5', 'w')).toBe(0);
	});

	it('recomputes sliding attacks after a blocker is removed', () => {
		const position: Position = {
			e1: ['K', 'w'],
			a1: ['R', 'w'],
			a3: ['R', 'w'],
			a4: ['Q', 'b'],
			a5: ['R', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'a4', 'w')).toBeGreaterThan(0);
	});

	it('rejects empty, wrong-color, and king targets without mutation', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			e8: ['K', 'b']
		};
		const snapshot = structuredClone(position);
		expect(staticExchangeGain(position, 'b5', 'w')).toBe(0);
		expect(staticExchangeGain(position, 'c4', 'w')).toBe(0);
		expect(staticExchangeGain(position, 'e8', 'w')).toBe(0);
		expect(position).toEqual(snapshot);
	});
});

describe('hasPositiveExchangeTarget', () => {
	it('finds a profitable attack on any valuable owner piece, not only the moved piece', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c5: ['B', 'w'],
			b6: ['Q', 'b'],
			a7: ['P', 'b'],
			e6: ['B', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'e6', 'w')).toBe(0);
		expect(staticExchangeGain(position, 'b6', 'w')).toBe(6);
		expect(hasPositiveExchangeTarget(position, 'b')).toBe(true);
	});

	it('does not treat pawns or kings as Brilliant sacrifice targets', () => {
		const position: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			b5: ['P', 'b'],
			e8: ['K', 'b']
		};
		expect(staticExchangeGain(position, 'b5', 'w')).toBe(1);
		expect(hasPositiveExchangeTarget(position, 'b')).toBe(false);
	});
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `pnpm exec vitest run src/lib/game/attacks.test.ts`

Expected: FAIL because `findAttackers`, `staticExchangeGain`, and `hasPositiveExchangeTarget` are not exported.

- [ ] **Step 3: Implement attacker discovery and recursive SEE**

Refactor `countAttackers` to `return findAttackers(...).length`. Keep the existing geometry constants/helpers and add this attacker discovery:

```typescript
export function findAttackers(
	position: Position,
	target: Square,
	byColor: PieceColor
): Square[] {
	const tf = fileOf(target);
	const tr = rankOf(target);
	const attackers: Square[] = [];

	for (const [df, dr] of KNIGHT_OFFSETS) {
		const square = squareAt(tf + df, tr + dr);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'N' && piece[1] === byColor) attackers.push(square);
	}
	for (const [df, dr] of KING_OFFSETS) {
		const square = squareAt(tf + df, tr + dr);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'K' && piece[1] === byColor) attackers.push(square);
	}

	for (const [df, dr] of ORTHOGONAL_DIRS) {
		let file = tf + df;
		let rank = tr + dr;
		while (true) {
			const square = squareAt(file, rank);
			if (!square) break;
			const piece = position[square];
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'R' || piece[0] === 'Q')) {
					attackers.push(square);
				}
				break;
			}
			file += df;
			rank += dr;
		}
	}
	for (const [df, dr] of DIAGONAL_DIRS) {
		let file = tf + df;
		let rank = tr + dr;
		while (true) {
			const square = squareAt(file, rank);
			if (!square) break;
			const piece = position[square];
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'B' || piece[0] === 'Q')) {
					attackers.push(square);
				}
				break;
			}
			file += df;
			rank += dr;
		}
	}

	const pawnRankOffset = byColor === 'w' ? -1 : 1;
	for (const df of [-1, 1]) {
		const square = squareAt(tf + df, tr + pawnRankOffset);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'P' && piece[1] === byColor) attackers.push(square);
	}
	return attackers;
}

export function countAttackers(
	position: Position,
	target: Square,
	byColor: PieceColor
): number {
	return findAttackers(position, target, byColor).length;
}
```

Add the following exchange implementation:

```typescript
const EXCHANGE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 100
};

function opposite(color: PieceColor): PieceColor {
	return color === 'w' ? 'b' : 'w';
}

function captureOn(position: Position, from: Square, target: Square): Position {
	const next = { ...position };
	const attacker = next[from];
	if (!attacker) return next;
	delete next[from];
	next[target] = attacker;
	return next;
}

export function staticExchangeGain(
	position: Position,
	target: Square,
	byColor: PieceColor
): number {
	const targetPiece = position[target];
	if (!targetPiece || targetPiece[1] === byColor || targetPiece[0] === 'K') return 0;

	let best = 0;
	for (const attackerSquare of findAttackers(position, target, byColor)) {
		const next = captureOn(position, attackerSquare, target);
		const gain =
			EXCHANGE_VALUES[targetPiece[0]] - staticExchangeGain(next, target, opposite(byColor));
		best = Math.max(best, gain);
	}
	return best;
}

export function hasPositiveExchangeTarget(
	position: Position,
	ownerColor: PieceColor,
	minimumPieceValue = 3
): boolean {
	const opponent = opposite(ownerColor);
	return Object.entries(position).some(([square, piece]) => {
		if (piece[1] !== ownerColor || piece[0] === 'P' || piece[0] === 'K') return false;
		if (EXCHANGE_VALUES[piece[0]] < minimumPieceValue) return false;
		if (findAttackers(position, square, opponent).length === 0) return false;
		return staticExchangeGain(position, square, opponent) > 0;
	});
}
```

- [ ] **Step 4: Run attack tests and the full Vitest suite**

Run: `pnpm exec vitest run src/lib/game/attacks.test.ts`

Expected: PASS.

Run: `pnpm exec vitest run`

Expected: all existing tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/game/attacks.ts src/lib/game/attacks.test.ts
git commit -m "feat: add value-aware static exchange evaluation"
```

---

### Task 2: Separate WDL and centipawn special-class score tracks

**Files:**
- Modify: `src/lib/game/classify.ts`
- Modify: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes from Task 1: `hasPositiveExchangeTarget(position, ownerColor, minimumPieceValue)`.
- Consumes existing: `winPercentForPly(...)` and `winPercentFromEval(evalPawns)`.
- Preserves public: `classifyGame(evalPerPly, wdlPerPly?, special?): ClassCode[]` and `SpecialClassInputs`.
- Internal `classifySpecial` receives both WDL mover scores and centipawn mover scores.

- [ ] **Step 1: Add failing classifier calibration tests**

Append these tests inside `describe('classifyGame with special classes', ...)`:

```typescript
	it('uses centipawn scores for Brilliant gates even when WDL is saturated', () => {
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves = { 1: { from: 'd4', to: 'a4', san: 'Na4' } };
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[990, 10, 0],
			[990, 10, 0]
		];
		expect(classifyGame([1.96, 2.08], wdlPerPly, { positions, moveMeta, bestMoves })).toEqual([
			'brilliant'
		]);
	});

	it('prefers second-line centipawn data over contradictory WDL for Great', () => {
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e2: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves = { 1: { from: 'e1', to: 'e2', san: 'Ke2' } };
		const secondEvalPerPly = [-1, null];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[790, 210, 0],
			null
		];
		expect(
			classifyGame([2, 2], undefined, {
				positions,
				moveMeta,
				bestMoves,
				secondEvalPerPly,
				secondWdlPerPly
			})
		).toEqual(['great']);
	});

	it('falls back to second-line WDL when centipawn data is absent', () => {
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e2: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves = { 1: { from: 'e1', to: 'e2', san: 'Ke2' } };
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[0, 0, 1000],
			null
		];
		expect(
			classifyGame([1, 1], undefined, { positions, moveMeta, bestMoves, secondWdlPerPly })
		).toEqual(['great']);
	});
```

Update all three pre-existing Great fixtures so their primary CP score and fallback second-line WDL actually exercise the new rules:

- “only-move (large MultiPV gap)” uses `evalPerPly = [2, 2]` and second WDL `[0, 0, 1000]` (primary CP about `67.6`, fallback second score `0`, giving a valid gap above `20`);
- “already decisively won” uses `evalPerPly = [20, 20]`, proving the CP `< 99` guard blocks it regardless of WDL;
- “clearly-but-not-decisively winning” uses `evalPerPly = [10, 10]` and second WDL `[0, 0, 1000]`, proving a high but sub-99 CP score can still be Great.

Keep the WDL arrays in those tests so they continue proving that WDL does not control the CP-only Great guard. Do not change `GREAT_ONLY_MOVE_GAP`.

- [ ] **Step 2: Run classifier tests and confirm RED**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`

Expected: at least the saturated-WDL Brilliant and contradictory-second-line tests FAIL under the old single-track logic.

- [ ] **Step 3: Implement the dual-track classifier**

Update imports:

```typescript
import { winPercentForPly, winPercentFromEval } from './accuracy';
import { hasPositiveExchangeTarget } from './attacks';
```

Make `secondLineWinPercent` CP-first and reuse the canonical sigmoid:

```typescript
function secondLineWinPercent(
	ply: number,
	secondEvalPerPly?: (number | null)[],
	secondWdlPerPly?: (Wdl | null)[]
): number | null {
	const evalPawns = secondEvalPerPly?.[ply];
	if (evalPawns !== null && evalPawns !== undefined) return winPercentFromEval(evalPawns);
	const wdl = secondWdlPerPly?.[ply];
	return wdl ? (wdl[0] + 0.5 * wdl[1]) / 10 : null;
}
```

Inside `classifyGame`, compute both arrays and both mover POV pairs:

```typescript
const wdlScores = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
const cpScores = evalPerPly.map(winPercentFromEval);

// inside the loop
const beforeWdlPov = mover === 'w' ? wdlScores[ply - 1] : 100 - wdlScores[ply - 1];
const afterWdlPov = mover === 'w' ? wdlScores[ply] : 100 - wdlScores[ply];
const beforeCpPov = mover === 'w' ? cpScores[ply - 1] : 100 - cpScores[ply - 1];
const afterCpPov = mover === 'w' ? cpScores[ply] : 100 - cpScores[ply];
const epLoss = beforeWdlPov - afterWdlPov;
```

Change the private `classifySpecial` inputs to `(ply, mover, beforeWdlPov, afterWdlPov, beforeCpPov, afterCpPov, epLoss, special)` and implement the gates in this exact order:

```typescript
const afterPosition = special.positions[ply];

if (
	nearBest &&
	afterPosition &&
	hasPositiveExchangeTarget(afterPosition, mover, BRILLIANT_MIN_SACRIFICE_VALUE) &&
	afterCpPov >= BRILLIANT_MIN_WIN &&
	beforeCpPov < BRILLIANT_NOT_WINNING
) {
	return 'brilliant';
}

if (playedIsBest && beforeCpPov < GREAT_NOT_ALREADY_DECIDED) {
	const secondWhitePov = secondLineWinPercent(
		ply - 1,
		special.secondEvalPerPly,
		special.secondWdlPerPly
	);
	if (secondWhitePov !== null) {
		const secondMoverPov = mover === 'w' ? secondWhitePov : 100 - secondWhitePov;
		if (beforeCpPov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) return 'great';
	}
}

if (beforeWdlPov >= MISS_WIN_BEFORE && afterWdlPov < MISS_WIN_AFTER) return 'miss';
```

Remove the obsolete moved-piece value lookup and the imports of `isPieceHanging`/`PIECE_VALUES`. Update the module comment so it explicitly documents the WDL and CP tracks rather than claiming one shared probability model.

- [ ] **Step 4: Run focused and full frontend tests**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts src/lib/game/attacks.test.ts`

Expected: PASS.

Run: `pnpm exec vitest run`

Expected: all tests PASS; the current simplified reference test remains green.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "fix: calibrate special classes with centipawn scores"
```

---

### Task 3: Freeze and enforce the complete Byrne–Fischer golden analysis

**Files:**
- Create: `src/lib/game/fixtures/byrne-fischer-analysis.json`
- Modify: `src/lib/game/classify.reference-game.test.ts`
- Temporarily modify, then restore before commit: `src-tauri/src/lib.rs`

**Interfaces:**
- Fixture shape:

```typescript
interface ReferenceAnalysisFixture {
	positions: Position[];
	moves: Move[];
	evalPerPly: number[];
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
	bestMoves: Record<number, Move & { san: string }>;
}
```

- Exact target class-array indices (zero-based move indices): `21` = `11...Na4`, `29` = `15...Nxc3`, `33` = `17...Be6`, `37` = `19...Ne2+`.

- [ ] **Step 1: Add the failing full-game golden test before creating the fixture**

Replace `src/lib/game/classify.reference-game.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import { classifyGame } from './classify';
import fixtureJson from './fixtures/byrne-fischer-analysis.json';
import { staticExchangeGain } from './attacks';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';

interface ReferenceAnalysisFixture {
	positions: Position[];
	moves: Move[];
	evalPerPly: number[];
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
	bestMoves: Record<number, Move & { san: string }>;
}

const fixture = fixtureJson as ReferenceAnalysisFixture;

function classifyReferenceGame() {
	return classifyGame(fixture.evalPerPly, fixture.wdlPerPly, {
		positions: fixture.positions,
		moveMeta: fixture.moves,
		bestMoves: fixture.bestMoves,
		secondEvalPerPly: fixture.secondEvalPerPly,
		secondWdlPerPly: fixture.secondWdlPerPly
	});
}

describe('Byrne vs. Fischer 1956 golden analysis', () => {
	it.each([
		[21, '11...Na4'],
		[29, '15...Nxc3'],
		[33, '17...Be6']
	])('classifies move index %i (%s) as Brilliant', (moveIndex) => {
		expect(classifyReferenceGame()[moveIndex]).toBe('brilliant');
	});

	it('detects Be6 through the exposed queen rather than the moved bishop', () => {
		const afterBe6 = fixture.positions[34];
		expect(staticExchangeGain(afterBe6, 'e6', 'w')).toBe(0);
		expect(staticExchangeGain(afterBe6, 'b6', 'w')).toBeGreaterThan(0);
	});

	it('classifies 19...Ne2+ as Great', () => {
		expect(classifyReferenceGame()[37]).toBe('great');
	});

	it('has exact Fischer counts and no extra special labels for either player', () => {
		const codes = classifyReferenceGame();
		const indices = (code: 'brilliant' | 'great') =>
			codes.flatMap((candidate, index) => (candidate === code ? [index] : []));

		expect(indices('brilliant')).toEqual([21, 29, 33]);
		expect(indices('great')).toEqual([37]);
		expect(indices('brilliant').filter((index) => index % 2 === 0)).toEqual([]);
		expect(indices('great').filter((index) => index % 2 === 0)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the golden test and confirm RED**

Run: `pnpm exec vitest run src/lib/game/classify.reference-game.test.ts`

Expected: FAIL because `./fixtures/byrne-fischer-analysis.json` does not exist.

- [ ] **Step 3: Capture a complete application-equivalent fixture**

Temporarily add an ignored Rust test under `#[cfg(test)]` in `src-tauri/src/lib.rs`. It must:

1. read `../../docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`;
2. call `pgn::parse_pgn`;
3. serialize every parsed position and move;
4. build FEN exactly like `src/lib/game/notation.ts::positionToFen`: board, side-to-move by ply, `- - 0`, and fullmove number;
5. call `analyze_fen_sync` once per position using the default engine options;
6. convert raw eval/WDL from side-to-move POV to White POV exactly like `loadRealAnalysis`;
7. store best moves under key `ply + 1` and second-line arrays under the current position index;
8. print a single pretty JSON object matching `ReferenceAnalysisFixture`.

Use this complete temporary module (it deliberately mirrors the frontend's simplified FEN and POV conversions rather than introducing a different chess-state model):

```rust
#[cfg(test)]
mod reference_fixture_dump {
    use super::*;
    use serde_json::{json, Map, Value};
    use std::collections::HashMap;

    type WirePosition = HashMap<String, (String, String)>;
    type WireWdl = (u32, u32, u32);

    fn side_for_ply(ply: usize) -> &'static str {
        if ply % 2 == 0 { "w" } else { "b" }
    }

    fn fullmove_for_ply(ply: usize) -> usize {
        ply / 2 + 1
    }

    fn position_to_fen(position: &WirePosition, ply: usize) -> String {
        let mut rows = Vec::new();
        for rank in (1..=8).rev() {
            let mut row = String::new();
            let mut empty = 0;
            for file in b'a'..=b'h' {
                let square = format!("{}{}", file as char, rank);
                match position.get(&square) {
                    None => empty += 1,
                    Some((piece, color)) => {
                        if empty > 0 {
                            row.push_str(&empty.to_string());
                            empty = 0;
                        }
                        let ch = piece.chars().next().unwrap();
                        row.push(if color == "w" { ch } else { ch.to_ascii_lowercase() });
                    }
                }
            }
            if empty > 0 {
                row.push_str(&empty.to_string());
            }
            rows.push(row);
        }
        format!(
            "{} {} - - 0 {}",
            rows.join("/"),
            side_for_ply(ply),
            fullmove_for_ply(ply)
        )
    }

    fn white_eval(eval_cp: i32, ply: usize) -> f64 {
        let pawns = eval_cp as f64 / 100.0;
        if side_for_ply(ply) == "w" { pawns } else { -pawns }
    }

    fn white_wdl(wdl: Option<WireWdl>, ply: usize) -> Value {
        match wdl {
            None => Value::Null,
            Some((win, draw, loss)) if side_for_ply(ply) == "w" => json!([win, draw, loss]),
            Some((win, draw, loss)) => json!([loss, draw, win]),
        }
    }

    fn best_move_json(
        position: &WirePosition,
        best_move_uci: &str,
    ) -> Option<Value> {
        if best_move_uci.len() < 4 {
            return None;
        }
        let from = &best_move_uci[0..2];
        let to = &best_move_uci[2..4];
        let (piece, _) = position.get(from)?;
        let prefix = if piece == "P" { "" } else { piece.as_str() };
        let capture = if position.contains_key(to) { "x" } else { "" };
        Some(json!({ "from": from, "to": to, "san": format!("{prefix}{capture}{to}") }))
    }

    #[test]
    #[ignore = "manual one-time Stockfish fixture capture"]
    fn dump_byrne_fischer_fixture() {
        let pgn = include_str!(
            "../../docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn"
        );
        let game = pgn::parse_pgn(pgn).expect("reference PGN must parse");
        let mut eval_per_ply = Vec::with_capacity(game.positions.len());
        let mut wdl_per_ply = Vec::with_capacity(game.positions.len());
        let mut second_eval_per_ply = Vec::with_capacity(game.positions.len());
        let mut second_wdl_per_ply = Vec::with_capacity(game.positions.len());
        let mut best_moves = Map::new();

        for (ply, position) in game.positions.iter().enumerate() {
            let result = analyze_fen_sync(position_to_fen(position, ply))
                .unwrap_or_else(|error| panic!("Stockfish failed at ply {ply}: {error}"));
            eval_per_ply.push(json!(white_eval(result.eval_cp, ply)));
            wdl_per_ply.push(white_wdl(result.wdl, ply));
            second_eval_per_ply.push(match result.second_eval_cp {
                Some(eval_cp) => json!(white_eval(eval_cp, ply)),
                None => Value::Null,
            });
            second_wdl_per_ply.push(white_wdl(result.second_wdl, ply));

            if ply + 1 < game.positions.len() {
                if let Some(best_move) = best_move_json(position, &result.best_move_uci) {
                    best_moves.insert((ply + 1).to_string(), best_move);
                }
            }
        }

        let fixture = json!({
            "positions": game.positions,
            "moves": game.moves,
            "evalPerPly": eval_per_ply,
            "wdlPerPly": wdl_per_ply,
            "secondEvalPerPly": second_eval_per_ply,
            "secondWdlPerPly": second_wdl_per_ply,
            "bestMoves": best_moves,
        });
        println!("REFERENCE_FIXTURE_BEGIN");
        println!("{}", serde_json::to_string_pretty(&fixture).unwrap());
        println!("REFERENCE_FIXTURE_END");
    }
}
```

Run only that ignored test with output visible:

```bash
cd src-tauri
cargo test dump_byrne_fischer_fixture -- --ignored --nocapture
```

Expected: one complete JSON object with `positions.length === moves.length + 1` and all five analysis collections populated. Add that object verbatim to `src/lib/game/fixtures/byrne-fischer-analysis.json` using `apply_patch`. Restore `src-tauri/src/lib.rs` immediately afterward and verify `git diff -- src-tauri/src/lib.rs` is empty. Do not commit the capture helper or raw terminal output.

- [ ] **Step 4: Validate fixture invariants and the four focused positions**

Run: `pnpm exec vitest run src/lib/game/classify.reference-game.test.ts`

Expected: PASS with exactly Brilliant indices `[21, 29, 33]` and Great indices `[37]`. If it fails, diagnose board geometry/POV/indexing; do not alter fixture values or add production exceptions to force the expected labels.

Run: `pnpm exec vitest run src/lib/game/attacks.test.ts src/lib/game/classify.test.ts src/lib/game/classify.reference-game.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/lib/game/fixtures/byrne-fischer-analysis.json src/lib/game/classify.reference-game.test.ts
git commit -m "test: freeze Byrne Fischer special classifications"
```

Confirm before committing: `git diff --cached --name-only` lists exactly the two test/fixture paths above.

---

### Task 4: Full verification and application confirmation

**Files:**
- Modify only if verification exposes a defect: the smallest file already named in Tasks 1–3.

**Interfaces:**
- No new interfaces. This task proves the implementation satisfies the design and preserves the rest of the application.

- [ ] **Step 1: Run the complete automated verification matrix**

```bash
pnpm exec vitest run
pnpm check
pnpm lint
pnpm build
cd src-tauri && cargo test
```

Expected:

- Vitest: all tests PASS.
- Svelte check: `0 errors`; pre-existing unrelated warnings are permitted but must be reported.
- ESLint: exit `0`.
- Vite build: exit `0`.
- Rust: all tests PASS (Stockfish-dependent tests may use their existing explicit skip behavior when Stockfish is unavailable).

- [ ] **Step 2: Reindex the codebase knowledge graph**

Run codebase-memory `index_repository` for `/home/jonas/Documents/Code/SecondBoard` in `moderate` mode with `persistence: false`, then query the graph for `staticExchangeGain`, `hasPositiveExchangeTarget`, and `classifyGame` to confirm the new call edge is visible.

Expected: all three symbols are indexed and `classifyGame`/`classifySpecial` reaches `hasPositiveExchangeTarget`.

- [ ] **Step 3: Request two-stage SDD review of the completed implementation**

First request a spec-compliance review against the design document and this plan. After it passes, request a code-quality review focused on SEE termination, mutation safety, score POV/indexing, and fixture isolation. Address findings through failing tests before changing production code.

- [ ] **Step 4: Confirm the real UI with the exact PGN**

Start the desktop application through the project's normal Tauri development command, load `docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`, wait for analysis to finish, and confirm the summary shows:

- Fischer: Brilliant `3`, Great `1`.
- Byrne: Brilliant `0`, Great `0`.
- Fischer's Brilliant moves: `11...Na4`, `15...Nxc3`, `17...Be6`.
- Fischer's Great move: `19...Ne2+`.

If live Stockfish produces different data from the frozen pass, capture the differing eval/WDL/best/second-line evidence and diagnose engine nondeterminism or configuration drift. Do not weaken the golden acceptance or add game-specific production behavior.

- [ ] **Step 5: Commit only if verification required a correction**

If no correction was required, do not create an empty commit. If a correction was required, stage only the relevant files and commit:

```bash
git commit -m "fix: satisfy special classification acceptance"
```

Then rerun the entire Step 1 matrix after the final code change.
