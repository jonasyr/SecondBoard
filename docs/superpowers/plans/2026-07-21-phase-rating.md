# Phase Rating (Opening/Middlegame/Endgame) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fully-mocked `PHASE_ROWS` (opening/middlegame/endgame badges in Game Review's "Phase" table) with a real phase-boundary detector faithfully ported from lichess's open-source `Divider.scala`, combined with this codebase's already-ported lichess accuracy algorithm applied per phase.

**Architecture:** A new pure module (`src/lib/game/phase.ts`) ports lichess's `Divider` algorithm (material-count/back-rank/"mixedness" heuristics) to find the ply boundaries between opening/middlegame/endgame from a game's `Position[]`. A second function in the same module slices `evalPerPly`/`wdlPerPly` to each phase's ply range and reuses the existing `computeGameAccuracy` (extended with one new optional parameter to fix a mover-parity bug that naive slicing would otherwise introduce) to get a real per-phase, per-side accuracy number. A third function maps that accuracy to one of 3 existing `ClassCode` badges (`best`/`good`/`inaccuracy`) via SecondBoard's own documented thresholds — chess.com's real icon thresholds are not public anywhere (confirmed this session via chess.com support articles/forum threads/community reimplementations — a chess.com moderator asked directly said "I'm not seeing anything documented"). `PhaseTable.svelte` becomes a props-based renderer (matching `BreakdownTable.svelte`'s established pattern) instead of importing mock data directly, with a `title` hover tooltip showing the exact accuracy percentage (this codebase's established tooltip convention — see `EvalBar.svelte`, `TitleBar.svelte`).

**Tech Stack:** SvelteKit 5, TypeScript, Vitest. No Rust/Tauri changes (phase division only needs `Position[]`, already available client-side).

## Global Constraints

- Port `Divider.scala`'s algorithm faithfully: exact thresholds (`majorsAndMinors <= 10` for midgame, `<= 6` for endgame, back-rank piece count `< 4`, `mixedness > 150`), exact `score` lookup table (copy verbatim, including its literal duplication of the `(3,0)` and `(4,0)` cases — do not "fix" or simplify it), exact 7x7 = 49 overlapping 2x2-region mixedness scan. Source: `https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/Divider.scala` (fetched and verified this session).
- The per-phase accuracy composition (slicing `computeGameAccuracy` per phase) and the accuracy-to-badge threshold mapping are **SecondBoard's own design choices**, not confirmed ports of lichess or chess.com behavior — both must be documented as such in code comments, exactly like `accuracy.ts` and `classify.ts` already flag their own approximations.
- Reuse the existing `ClassCode`/`TOKENS.classification`/`ClassBadge.svelte` system for icons. Do not add new `ClassCode` values or new icon/asset files. Only `best`, `good`, `inaccuracy` are used for phase badges.
- Follow the `analysisStatus === 'ready' ? real : []` gating idiom already used in `ReviewTab.svelte` for `evalPerPly`/`wdlPerPly`/accuracy — phase accuracy must show an empty/placeholder state (never a fabricated number) whenever analysis isn't ready.
- `computeGameAccuracy`'s new `startPly` parameter must be optional and default to `0`, reproducing every existing call site's behavior byte-for-byte (this codebase's established backward-compatible-optional-parameter convention, used in every prior iteration).
- Remove `PHASE_ROWS` from `mock-data.ts` and its assertion in `mock-data.test.ts` once `PhaseTable.svelte` no longer imports it (matches this codebase's established "delete a mock export once real data supersedes it" precedent, e.g. `SAN_LIST` in Iteration 6).
- No Rust changes. No new dependencies.
- Full verification matrix at the end: `pnpm exec vitest run`, `pnpm check`, `pnpm lint`, `pnpm build`. No `cargo test` needed — this plan makes no Rust changes.

---

### Task 1: Port lichess's `Divider` phase-boundary algorithm

**Files:**
- Create: `src/lib/game/phase.ts`
- Create: `src/lib/game/phase.test.ts`

**Interfaces:**
- Consumes: `Position`, `Piece`, `Square` from `$lib/board/types` (`Position = Record<Square, Piece>`, `Piece = [PieceType, PieceColor]`, `Square = string` e.g. `'e4'`).
- Produces: `export interface PhaseDivision { middlePly: number | null; endPly: number | null; totalPlies: number }` and `export function dividePhases(positions: Position[]): PhaseDivision`. `positions[0]` is the start position; `positions.length - 1` is the last ply's index (same convention as `GameData.positions`/`evalPerPly` throughout this codebase). `middlePly`/`endPly` are ply INDICES into `positions` (not move numbers), or `null` if that phase transition was never detected (e.g. `endPly` is `null` for a game that ends before reaching the material threshold). Later tasks rely on: `middlePly === null` means the whole game is "opening"; `endPly === null` means the game never reaches "endgame" (middlegame runs to the end).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/phase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { dividePhases } from './phase';
import type { Position } from '$lib/board/types';

/** Full starting position, White's home rank first, matching this codebase's
 * existing test fixtures elsewhere (e.g. classify.test.ts). */
const STARTING_POSITION: Position = {
	a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], d1: ['Q', 'w'],
	e1: ['K', 'w'], f1: ['B', 'w'], g1: ['N', 'w'], h1: ['R', 'w'],
	a2: ['P', 'w'], b2: ['P', 'w'], c2: ['P', 'w'], d2: ['P', 'w'],
	e2: ['P', 'w'], f2: ['P', 'w'], g2: ['P', 'w'], h2: ['P', 'w'],
	a7: ['P', 'b'], b7: ['P', 'b'], c7: ['P', 'b'], d7: ['P', 'b'],
	e7: ['P', 'b'], f7: ['P', 'b'], g7: ['P', 'b'], h7: ['P', 'b'],
	a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], d8: ['Q', 'b'],
	e8: ['K', 'b'], f8: ['B', 'b'], g8: ['N', 'b'], h8: ['R', 'b']
};

describe('dividePhases', () => {
	it('never leaves the opening while the starting position is repeated (no material/development trigger)', () => {
		const positions = [STARTING_POSITION, STARTING_POSITION, STARTING_POSITION];
		const division = dividePhases(positions);
		expect(division).toEqual({ middlePly: null, endPly: null, totalPlies: 3 });
	});

	it('detects midgame via majorsAndMinors <= 10 (numerically verified: total 6 white + 4 black = 10)', () => {
		// White: R,N,B,Q,B,N (Q kept, one rook removed) = 6 majors/minors.
		// Black: R,N,B,Q (king excluded) = 4 majors/minors. Total = 10, exactly
		// at the trigger threshold. Verified via a standalone port of this
		// exact logic before writing this test: majorsAndMinors=10,
		// backrankSparse=false, mixedness=16 (well under 150) -- isolates the
		// material trigger from the other two conditions.
		const sparse: Position = {
			a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], d1: ['Q', 'w'], e1: ['K', 'w'],
			f1: ['B', 'w'], g1: ['N', 'w'], h1: ['R', 'w'],
			a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], d8: ['Q', 'b'], e8: ['K', 'b']
		};
		delete sparse.h1;
		const positions = [STARTING_POSITION, sparse];
		const division = dividePhases(positions);
		expect(division.middlePly).toBe(1);
	});

	it('detects midgame via backrankSparse (fewer than 4 pieces remain on a home rank), isolated from the material trigger', () => {
		// Move every White rank-1 piece except the king to rank 3 -- nothing is
		// captured, so majorsAndMinors stays at the full 14 (well above the 10
		// threshold) and mixedness stays low (55, under 150); only rank 1's own
		// piece count (1: just the king) drops below 4. Verified via a
		// standalone port of this exact logic before writing this test:
		// majorsAndMinors=14, backrankSparse=true, mixedness=55.
		const developed: Position = { ...STARTING_POSITION };
		delete developed.a1;
		delete developed.b1;
		delete developed.c1;
		delete developed.d1;
		delete developed.f1;
		delete developed.g1;
		delete developed.h1;
		developed.a3 = ['R', 'w'];
		developed.b3 = ['N', 'w'];
		developed.c3 = ['B', 'w'];
		developed.d3 = ['Q', 'w'];
		developed.f3 = ['B', 'w'];
		developed.g3 = ['N', 'w'];
		developed.h3 = ['R', 'w'];
		const positions = [STARTING_POSITION, developed];
		const division = dividePhases(positions);
		expect(division.middlePly).toBe(1);
	});

	it('detects endgame via majorsAndMinors <= 6 at a LATER ply than midgame', () => {
		// ply1: majorsAndMinors=10 (6 white + 4 black) -- triggers midgame,
		// does NOT trigger endgame (10 > 6). ply2: majorsAndMinors=4 (2 white +
		// 2 black) -- triggers endgame. Verified via a standalone port of this
		// exact logic before writing this test.
		const midgame: Position = {
			a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], d1: ['Q', 'w'], e1: ['K', 'w'],
			f1: ['B', 'w'], g1: ['N', 'w'],
			a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], d8: ['Q', 'b'], e8: ['K', 'b']
		};
		const endgame: Position = {
			a1: ['R', 'w'], b1: ['N', 'w'], e1: ['K', 'w'],
			a8: ['R', 'b'], b8: ['N', 'b'], e8: ['K', 'b']
		};
		const positions = [STARTING_POSITION, midgame, endgame];
		const division = dividePhases(positions);
		expect(division.middlePly).toBe(1);
		expect(division.endPly).toBe(2);
	});

	it('nulls out middlePly when midgame and endgame trigger at the exact same ply (Division constructor safety net)', () => {
		// A position with majorsAndMinors <= 6 always ALSO satisfies <= 10, so
		// if it's the very first ply examined, midGame and endGame land on the
		// identical index. The real Divider.scala filters midGame out in this
		// case (`m < endGame` is false when m === endGame) -- port that exactly,
		// don't "fix" it to keep middlePly.
		const bothAtOnce: Position = {
			a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], e1: ['K', 'w'],
			a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], e8: ['K', 'b']
		}; // 6 majors/minors total -- satisfies both thresholds simultaneously
		const positions = [STARTING_POSITION, bothAtOnce];
		const division = dividePhases(positions);
		expect(division.middlePly).toBeNull();
		expect(division.endPly).toBe(1);
	});

	it('never searches for endgame if no midgame ply was ever found', () => {
		// A position with <=6 majors/minors would normally trigger endgame, but
		// since it's ALSO always <=10, midgame always fires no later than
		// endgame in practice; this test instead asserts the documented
		// contract directly: no midgame -> endPly must be null regardless of
		// what dividePhases would compute for endgame in isolation.
		const positions = [STARTING_POSITION];
		const division = dividePhases(positions);
		expect(division.middlePly).toBeNull();
		expect(division.endPly).toBeNull();
	});

	it('reports totalPlies as positions.length', () => {
		const positions = [STARTING_POSITION, STARTING_POSITION, STARTING_POSITION, STARTING_POSITION];
		expect(dividePhases(positions).totalPlies).toBe(4);
	});

	it('detects midgame via mixedness > 150 on a highly interleaved board', () => {
		// Alternating white/black pieces packed across many 2x2 regions scores
		// heavily under the mixedness heuristic even though majorsAndMinors and
		// backrankSparse would not trigger on their own. Fill ranks 3-6 with
		// alternating-color knights (never triggers majorsAndMinors<=10 since
		// there are 16 of them, and back ranks 1/8 are untouched/full).
		const interleaved: Position = { ...STARTING_POSITION };
		const files = 'abcdefgh';
		let white = true;
		for (const rank of [3, 4, 5, 6]) {
			for (const file of files) {
				interleaved[`${file}${rank}`] = ['N', white ? 'w' : 'b'];
				white = !white;
			}
		}
		const positions = [STARTING_POSITION, interleaved];
		const division = dividePhases(positions);
		expect(division.middlePly).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: FAIL with "Failed to resolve import './phase'" (the module doesn't exist yet).

- [ ] **Step 3: Implement `dividePhases`**

Create `src/lib/game/phase.ts`:

```typescript
/**
 * Real game-phase (opening/middlegame/endgame) boundary detection, replacing
 * mock-data.ts's fully-mocked PHASE_ROWS. Faithfully ported from lichess's
 * open-source `Divider` (Scala): https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/Divider.scala
 * (fetched and verified 2026-07-21). Confirmed by lichess founder Thibault,
 * on the lichess feedback forum, as the actual algorithm lichess uses to
 * answer "how does lichess determine the phase of a game."
 *
 * This module operates on this codebase's `Position` shape (square -> piece)
 * instead of scalachess's bitboards, but is otherwise a line-for-line port:
 * same thresholds, same back-rank check, same hand-tuned "mixedness" scoring
 * table (copied verbatim, including its literal duplication of the (3,0) and
 * (4,0) score-table cases -- not a bug we should "fix", since fixing it would
 * make this no longer match lichess's actual behavior).
 */
import type { Piece, PieceColor, Position, Square } from '$lib/board/types';

const FILES = 'abcdefgh';

function fileOf(square: Square): number {
	return FILES.indexOf(square[0]);
}

function rankOf(square: Square): number {
	return Number(square[1]);
}

/** `Divider.majorsAndMinors`: every piece except kings and pawns, both colors combined. */
function majorsAndMinors(position: Position): number {
	let count = 0;
	for (const [type] of Object.values(position)) {
		if (type !== 'K' && type !== 'P') count++;
	}
	return count;
}

/** `Divider.backrankSparse`: true once either side has fewer than 4 pieces
 * left on its own home rank (any piece type, not just the original back-rank
 * ones -- this is "how many pieces currently occupy that rank", a proxy for
 * "pieces have developed/castled off the back rank"). */
function backrankSparse(position: Position): boolean {
	let whiteOnRank1 = 0;
	let blackOnRank8 = 0;
	for (const [square, piece] of Object.entries(position) as Array<[Square, Piece]>) {
		const rank = rankOf(square);
		if (rank === 1 && piece[1] === 'w') whiteOnRank1++;
		if (rank === 8 && piece[1] === 'b') blackOnRank8++;
	}
	return whiteOnRank1 < 4 || blackOnRank8 < 4;
}

/** `Divider.score`: hand-tuned lookup table for one 2x2 board region's
 * "mixedness" contribution, given how many white/black pieces (of any type)
 * occupy it and the region's row position (`y`, 1-7). Copied verbatim from
 * the Scala source's `@switch` match -- see this file's header comment. */
function regionScore(y: number, white: number, black: number): number {
	if (white === 0 && black === 0) return 0;
	if (white === 1 && black === 0) return 1 + (8 - y);
	if (white === 2 && black === 0) return y > 2 ? 2 + (y - 2) : 0;
	if (white === 3 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
	if (white === 4 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
	if (white === 0 && black === 1) return 1 + y;
	if (white === 1 && black === 1) return 5 + Math.abs(4 - y);
	if (white === 2 && black === 1) return 4 + (y - 1);
	if (white === 3 && black === 1) return 5 + (y - 1);
	if (white === 0 && black === 2) return y < 6 ? 2 + (6 - y) : 0;
	if (white === 1 && black === 2) return 4 + (7 - y);
	if (white === 2 && black === 2) return 7;
	if (white === 0 && black === 3) return y < 7 ? 3 + (7 - y) : 0;
	if (white === 1 && black === 3) return 5 + (7 - y);
	if (white === 0 && black === 4) return y < 7 ? 3 + (7 - y) : 0;
	return 0;
}

/** `Divider.mixedness`: sum of `regionScore` over all 49 overlapping 2x2
 * regions of the board (a 7x7 grid of region top-left corners, files/ranks
 * offset 0-6). Higher values mean white and black pieces are interleaved
 * together rather than clustered on their own halves -- a proxy for an
 * active middlegame. */
function mixedness(position: Position): number {
	const entries = Object.entries(position) as Array<[Square, Piece]>;
	let total = 0;
	for (let yOffset = 0; yOffset <= 6; yOffset++) {
		for (let xOffset = 0; xOffset <= 6; xOffset++) {
			let white = 0;
			let black = 0;
			for (const [square, piece] of entries) {
				const file = fileOf(square);
				const rank = rankOf(square);
				if (file >= xOffset && file <= xOffset + 1 && rank >= yOffset + 1 && rank <= yOffset + 2) {
					if (piece[1] === 'w') white++;
					else black++;
				}
			}
			total += regionScore(yOffset + 1, white, black);
		}
	}
	return total;
}

const MAJORS_MINORS_MIDGAME = 10;
const MAJORS_MINORS_ENDGAME = 6;
const MIXEDNESS_MIDGAME = 150;

export interface PhaseDivision {
	/** Ply index (into the same `positions[]` array passed in) where the
	 * middlegame begins, or `null` if the game never left the opening. */
	middlePly: number | null;
	/** Ply index where the endgame begins, or `null` if the game never
	 * reaches the endgame material threshold (or never reached a midgame). */
	endPly: number | null;
	totalPlies: number;
}

/**
 * Finds a game's opening/middlegame/endgame ply boundaries. `positions[0]`
 * is the starting position; `positions.length - 1` is the last ply reached.
 * Faithful port of `Divider.apply` -- see this file's header comment.
 */
export function dividePhases(positions: Position[]): PhaseDivision {
	let midGame: number | null = null;
	for (let ply = 0; ply < positions.length; ply++) {
		const position = positions[ply];
		if (
			majorsAndMinors(position) <= MAJORS_MINORS_MIDGAME ||
			backrankSparse(position) ||
			mixedness(position) > MIXEDNESS_MIDGAME
		) {
			midGame = ply;
			break;
		}
	}

	let endGame: number | null = null;
	if (midGame !== null) {
		for (let ply = 0; ply < positions.length; ply++) {
			if (majorsAndMinors(positions[ply]) <= MAJORS_MINORS_ENDGAME) {
				endGame = ply;
				break;
			}
		}
	}

	const middlePly = midGame !== null && (endGame === null || midGame < endGame) ? midGame : null;

	return { middlePly, endPly: endGame, totalPlies: positions.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/phase.ts src/lib/game/phase.test.ts
git commit -m "feat(phase): port lichess's Divider algorithm for opening/middlegame/endgame boundaries"
```

---

### Task 2: Per-phase accuracy and badge-ready rows

**Files:**
- Modify: `src/lib/game/accuracy.ts`
- Modify: `src/lib/game/accuracy.test.ts`
- Modify: `src/lib/game/phase.ts`
- Modify: `src/lib/game/phase.test.ts`

**Interfaces:**
- Consumes: `dividePhases`/`PhaseDivision` from Task 1 (same file). `computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy` and `Wdl` from `./accuracy` (existing, `GameAccuracy = { white: number | null; black: number | null }`).
- Produces: `computeGameAccuracy`'s new optional 3rd parameter `startPly = 0` (additive, backward compatible). `export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy'` and `export interface PhaseRow { name: 'Opening' | 'Middlegame' | 'Endgame'; white: { code: PhaseBadgeCode; accuracy: number } | null; black: { code: PhaseBadgeCode; accuracy: number } | null }` and `export function getPhaseRows(positions: Position[], evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): PhaseRow[]` (always returns exactly 3 rows, in Opening/Middlegame/Endgame order; `white`/`black` are `null` when that side has fewer than 2 analyzed plies in that phase, matching `computeGameAccuracy`'s own null-for-insufficient-data behavior -- never a fabricated number). Task 3 renders this directly.

**Why `computeGameAccuracy` needs a new parameter:** `computeGameAccuracy`'s per-move loop calls `sideToMoveForPly(ply)` where `ply` is the LOOP index (0-based from the start of whatever array it's given). `sideToMoveForPly(ply)` is `ply % 2 === 0 ? 'w' : 'b'` -- a GLOBAL parity function. If Task 2's `getPhaseRows` simply sliced `evalPerPly`/`wdlPerPly` to a phase's `[start, end)` range and called `computeGameAccuracy` on the slice directly, every mover color inside that slice would be silently WRONG whenever `start` is odd (i.e. whenever a phase happens to begin on Black's move) -- White's moves would be attributed to Black and vice versa for that entire phase. Adding an optional `startPly` parameter (defaulting to `0`, so every existing call site is completely unaffected) lets the internal loop compute `sideToMoveForPly(startPly + ply)` instead, fixing this without touching any other behavior.

- [ ] **Step 1: Write the failing test for `computeGameAccuracy`'s new parameter**

Add to `src/lib/game/accuracy.test.ts` (find the `describe('computeGameAccuracy', ...)` block and add this test inside it; if you're not sure of the exact existing block name, run `grep -n "describe(" src/lib/game/accuracy.test.ts` first to confirm):

```typescript
	it('attributes movers correctly when startPly shifts an odd-indexed slice (Black moves first in the slice)', () => {
		// Move index `m` (0-indexed from the game's own start, White=even,
		// Black=odd per sideToMoveForPly) goes FROM evalPerPly[m] TO
		// evalPerPly[m+1]. A slice that starts at global ply 1 represents move
		// index 1 (Black's 1st move, since sideToMoveForPly(1) === 'b').
		// Full-game evalPerPly: ply0(start)=0, ply1=5 (White up a bit after its
		// own 1st move), ply2=-5 (White-POV eval swings hugely in Black's
		// favor after Black's 1st move).
		const evalPerPly = [0, 5, -5];
		const slice = evalPerPly.slice(1, 3); // [5, -5] -- just Black's move, ply1->ply2

		const withoutStartPly = computeGameAccuracy(slice); // WRONG: treats local index 0 as White's move
		const withStartPly = computeGameAccuracy(slice, undefined, 1); // correct: local index 0 is global ply1, Black to move

		// Without startPly, the single move in this slice is misattributed to
		// White: White-POV win% drops from ~86.3 (eval +5) to ~13.7 (eval -5),
		// a big self-inflicted loss -- some real (non-null) low accuracy, with
		// Black getting no data (null, zero moves attributed to it).
		// With startPly=1, the mover is correctly Black, and the SAME eval
		// swing (+5 -> -5) IMPROVES Black's own win% (13.7 -> 86.3), so
		// Black's accuracy must be exactly 100 (moveAccuracyFromWinPercents
		// returns 100 whenever afterPov >= beforePov) and White gets no data.
		expect(withoutStartPly.white).not.toBeNull();
		expect(withoutStartPly.black).toBeNull();
		expect(withStartPly.white).toBeNull();
		expect(withStartPly.black).toBe(100);
	});

	it('defaults startPly to 0, reproducing existing behavior byte-for-byte when omitted', () => {
		const evalPerPly = [0, 1, 0.5];
		const withDefault = computeGameAccuracy(evalPerPly);
		const withExplicitZero = computeGameAccuracy(evalPerPly, undefined, 0);
		expect(withDefault).toEqual(withExplicitZero);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL on the first new test (`withStartPly.black` is not `100` -- the 3rd argument is silently ignored since the parameter doesn't exist yet, so both calls behave identically and the "attributes movers correctly" assertions for the with-startPly case fail).

- [ ] **Step 3: Add the `startPly` parameter**

In `src/lib/game/accuracy.ts`, modify `computeGameAccuracy`'s signature and its per-move loop (the function currently reads, per this session's inspection -- confirm exact current line numbers with `grep -n "export function computeGameAccuracy" -A 3 src/lib/game/accuracy.ts` before editing):

```typescript
export function computeGameAccuracy(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	startPly = 0
): GameAccuracy {
```

And inside the function body, change:

```typescript
	for (let ply = 0; ply < moveCount; ply++) {
		const mover = sideToMoveForPly(ply);
```

to:

```typescript
	for (let ply = 0; ply < moveCount; ply++) {
		const mover = sideToMoveForPly(startPly + ply);
```

Also update the function's doc comment (immediately above it) to mention the new parameter -- append this sentence to the existing comment block: `` `startPly` (default 0) shifts the mover-color attribution for callers passing a SLICE of a larger game's evalPerPly/wdlPerPly (e.g. one phase's ply range) rather than the whole game from ply 0 -- see phase.ts's `getPhaseRows` for the motivating caller. ``

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS, full file (confirm the count via the test output; every pre-existing test must still pass unmodified).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat(accuracy): add optional startPly param for correct mover attribution on ply-range slices"
```

- [ ] **Step 6: Write the failing tests for `getPhaseRows`**

Add to `src/lib/game/phase.test.ts` (new `describe` block, new imports at the top -- add `Wdl` and `computeGameAccuracy` are NOT needed as imports here since the test only calls `getPhaseRows`; just add `getPhaseRows` to the existing `import { dividePhases } from './phase';` line, making it `import { dividePhases, getPhaseRows } from './phase';`):

```typescript
describe('getPhaseRows', () => {
	it('always returns exactly 3 rows in Opening/Middlegame/Endgame order', () => {
		const rows = getPhaseRows([STARTING_POSITION, STARTING_POSITION], [0, 0]);
		expect(rows.map((r) => r.name)).toEqual(['Opening', 'Middlegame', 'Endgame']);
	});

	it('returns null for both sides of a phase with fewer than 2 analyzed plies', () => {
		// A 2-position (1-ply) game never leaves the opening (dividePhases
		// returns middlePly: null), so Middlegame and Endgame each get a
		// zero-length slice -- no data, not a fabricated badge.
		const rows = getPhaseRows([STARTING_POSITION, STARTING_POSITION], [0, 0.2]);
		const middlegame = rows.find((r) => r.name === 'Middlegame')!;
		const endgame = rows.find((r) => r.name === 'Endgame')!;
		expect(middlegame.white).toBeNull();
		expect(middlegame.black).toBeNull();
		expect(endgame.white).toBeNull();
		expect(endgame.black).toBeNull();
	});

	it('assigns the "best" badge code for high accuracy and "inaccuracy" for low accuracy', () => {
		// Opening-only game (dividePhases never leaves the opening for a
		// repeated starting position, 4 plies = 2 White + 1 Black move).
		// evalPerPly: ply0=0, ply1=0 (White's move: 0->0, perfect, "best"),
		// ply2=9 (Black's move: 0->9, White-POV eval swinging hugely AGAINST
		// Black is a catastrophic self-inflicted drop in Black's own win% --
		// "inaccuracy"), ply3=9 (White's 2nd move: 9->9, unchanged, "best",
		// averaged with White's 1st move -> still "best" overall).
		const positions = [STARTING_POSITION, STARTING_POSITION, STARTING_POSITION, STARTING_POSITION];
		const evalPerPly = [0, 0, 9, 9];
		const rows = getPhaseRows(positions, evalPerPly);
		const opening = rows.find((r) => r.name === 'Opening')!;
		expect(opening.white?.code).toBe('best');
		expect(opening.black?.code).toBe('inaccuracy');
	});

	it('includes the exact accuracy value alongside the badge code (for the UI tooltip)', () => {
		const positions = [STARTING_POSITION, STARTING_POSITION];
		const evalPerPly = [0, 0];
		const rows = getPhaseRows(positions, evalPerPly);
		const opening = rows.find((r) => r.name === 'Opening')!;
		expect(opening.white?.accuracy).toBe(100);
	});
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: FAIL with "getPhaseRows is not a function" (or a TypeScript resolution error, since it doesn't exist yet).

- [ ] **Step 8: Implement `getPhaseRows`**

Append to `src/lib/game/phase.ts` (add these imports to the top of the file, alongside the existing `import type { Piece, PieceColor, Position, Square } from '$lib/board/types';` line -- add a new line: `import { computeGameAccuracy, type Wdl } from './accuracy';`):

```typescript
/**
 * Which of the 3 existing chess.com-style classification badges to show for
 * a phase's accuracy. Reuses the existing `best`/`good`/`inaccuracy`
 * ClassCode/TOKENS.classification entries (green star / green check / amber
 * "?!") rather than inventing new icons. chess.com's own real thresholds for
 * its Opening/Middlegame/Endgame phase icons are NOT publicly documented
 * anywhere (confirmed via chess.com's own support articles and forum threads
 * -- a chess.com moderator, asked directly, replied "I'm not seeing anything
 * documented. I'm asking about it") -- these thresholds are SecondBoard's own
 * design choice, not a chess.com or lichess port.
 */
export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy';

const PHASE_BEST_THRESHOLD = 90;
const PHASE_GOOD_THRESHOLD = 75;

function phaseBadgeCode(accuracy: number): PhaseBadgeCode {
	if (accuracy >= PHASE_BEST_THRESHOLD) return 'best';
	if (accuracy >= PHASE_GOOD_THRESHOLD) return 'good';
	return 'inaccuracy';
}

export interface PhaseRow {
	name: 'Opening' | 'Middlegame' | 'Endgame';
	white: { code: PhaseBadgeCode; accuracy: number } | null;
	black: { code: PhaseBadgeCode; accuracy: number } | null;
}

/**
 * Real per-phase, per-side accuracy and badge rows, replacing mock-data.ts's
 * PHASE_ROWS. Phase boundaries come from `dividePhases` (Task 1, a lichess
 * `Divider` port); each phase's accuracy reuses this codebase's existing
 * lichess-ported `computeGameAccuracy`, applied only to that phase's ply
 * range (via `startPly` so mover-color attribution stays correct across the
 * slice boundary -- see accuracy.ts). This composition -- computing accuracy
 * separately per phase bucket -- is SecondBoard's own design choice; lichess
 * itself only exposes a similar per-phase breakdown in its separate,
 * account-gated "Insights" feature, whose exact source could not be
 * confirmed this session.
 */
export function getPhaseRows(
	positions: Position[],
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): PhaseRow[] {
	const division = dividePhases(positions);
	const openingEnd = division.middlePly ?? division.totalPlies;
	const middleEnd = division.endPly ?? division.totalPlies;

	const ranges: Array<[PhaseRow['name'], number, number]> = [
		['Opening', 0, openingEnd],
		['Middlegame', openingEnd, middleEnd],
		['Endgame', middleEnd, division.totalPlies]
	];

	return ranges.map(([name, start, end]) => {
		const { white, black } = computeGameAccuracy(
			evalPerPly.slice(start, end),
			wdlPerPly?.slice(start, end),
			start
		);
		return {
			name,
			white: white === null ? null : { code: phaseBadgeCode(white), accuracy: white },
			black: black === null ? null : { code: phaseBadgeCode(black), accuracy: black }
		};
	});
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: PASS, all tests (Task 1's 8 plus Task 2's 4 = 12).

- [ ] **Step 10: Commit**

```bash
git add src/lib/game/phase.ts src/lib/game/phase.test.ts
git commit -m "feat(phase): compute real per-phase accuracy and badge rows"
```

---

### Task 3: Wire into the UI, remove the mock

**Files:**
- Modify: `src/lib/components/PhaseTable.svelte`
- Modify: `src/lib/components/PhaseTable.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/game/mock-data.ts`
- Modify: `src/lib/game/mock-data.test.ts`

**Interfaces:**
- Consumes: `PhaseRow`, `getPhaseRows` from `$lib/game/phase` (Task 2). `ClassBadge` (existing, `Props = { classCode: ClassCode; size: 16 | 21 | 22 }`).
- Produces: `PhaseTable.svelte`'s new `Props = { rows: PhaseRow[] }` (breaking change to this one component's props, matching the established `BreakdownTable`/`MoveList` precedent of earlier iterations -- its only caller, `ReviewTab.svelte`, is updated in this same task).

- [ ] **Step 1: Write the failing test for the new `PhaseTable` props**

Replace the full contents of `src/lib/components/PhaseTable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { PhaseRow } from '$lib/game/phase';
import PhaseTable from './PhaseTable.svelte';

describe('PhaseTable', () => {
	it('renders 3 phase rows with a badge per side when accuracy data is present', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.2 }, black: { code: 'good', accuracy: 81.4 } },
			{ name: 'Middlegame', white: { code: 'good', accuracy: 79.9 }, black: { code: 'inaccuracy', accuracy: 62.1 } },
			{ name: 'Endgame', white: { code: 'best', accuracy: 95.0 }, black: { code: 'best', accuracy: 91.3 } }
		];
		const { container, getByText } = render(PhaseTable, { props: { rows } });

		expect(container.querySelectorAll('.row')).toHaveLength(3);
		expect(getByText('Opening')).toBeTruthy();
		expect(getByText('Middlegame')).toBeTruthy();
		expect(getByText('Endgame')).toBeTruthy();
	});

	it('shows a dash placeholder instead of a badge for a phase with no accuracy data', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 100 }, black: { code: 'best', accuracy: 100 } },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { getAllByText } = render(PhaseTable, { props: { rows } });
		expect(getAllByText('—')).toHaveLength(2);
	});

	it('sets an exact-accuracy tooltip on each present badge', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.25 }, black: null },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { container } = render(PhaseTable, { props: { rows } });
		const tooltip = container.querySelector('[title*="98.3"]');
		expect(tooltip).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/PhaseTable.test.ts`
Expected: FAIL (the old `PhaseTable.svelte` takes no `rows` prop and imports `PHASE_ROWS` from mock-data.ts, so `getByText('Opening')` etc. still incidentally pass but the dash/tooltip tests fail -- confirm at least the last two tests fail).

- [ ] **Step 3: Rewrite `PhaseTable.svelte`**

Replace the full contents of `src/lib/components/PhaseTable.svelte`:

```svelte
<script lang="ts">
	import type { PhaseRow } from '$lib/game/phase';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		rows: PhaseRow[];
	}

	let { rows }: Props = $props();

	function tooltip(side: 'White' | 'Black', phaseName: string, accuracy: number): string {
		return `${side}: ${accuracy.toFixed(1)}% accuracy in the ${phaseName}`;
	}
</script>

<div class="phases">
	{#each rows as row (row.name)}
		<div class="row">
			<span class="name">{row.name}</span>
			<div class="badge-col">
				{#if row.white}
					<span title={tooltip('White', row.name, row.white.accuracy)}>
						<ClassBadge classCode={row.white.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
			<span></span>
			<div class="badge-col">
				{#if row.black}
					<span title={tooltip('Black', row.name, row.black.accuracy)}>
						<ClassBadge classCode={row.black.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 5px 0;
	}
	.name {
		font-size: 12.5px;
		color: var(--color-text-secondary-alt);
		font-weight: 500;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
	.empty {
		color: var(--color-text-tertiary);
		font-size: 13px;
	}
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/PhaseTable.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Wire real data into `ReviewTab.svelte`**

In `src/lib/components/ReviewTab.svelte`, add `getPhaseRows` to the imports (change `import { getAccuracySummary } from '$lib/game/review';` to add a second import line right after it: `import { getPhaseRows } from '$lib/game/phase';`), add a derived value right after the existing `breakdownRows` derived value:

```typescript
	const breakdownRows = $derived(getBreakdownRows(classCodes));
	const phaseRows = $derived(
		getPhaseRows(
			appState.game!.positions,
			appState.analysisStatus === 'ready' ? evalPerPly : [],
			appState.analysisStatus === 'ready' ? wdlPerPly : []
		)
	);
```

and change the `<PhaseTable />` line to:

```svelte
	<PhaseTable rows={phaseRows} />
```

- [ ] **Step 6: Remove the superseded mock**

In `src/lib/game/mock-data.ts`, delete the `PHASE_ROWS` export entirely:

```typescript
export const PHASE_ROWS: Array<[string, ClassCode, ClassCode]> = [
	['Opening', 'great', 'good'],
	['Middlegame', 'best', 'excellent'],
	['Endgame', 'inaccuracy', 'good']
];
```

(Check with `grep -n "ClassCode" src/lib/game/mock-data.ts` afterward -- if `ClassCode` is still imported and still used elsewhere in the file, e.g. by `CLASS_CODES`/`COACH_TEXT_MAP`/`BREAKDOWN_ROWS`, leave the import; it will still be needed.)

In `src/lib/game/mock-data.test.ts`, remove `PHASE_ROWS` from the import list (change the import block to drop the `PHASE_ROWS,` line) and change the test:

```typescript
	it('has 10 breakdown rows and 3 phase rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
		expect(PHASE_ROWS).toHaveLength(3);
	});
```

to:

```typescript
	it('has 10 breakdown rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
	});
```

- [ ] **Step 7: Run the full frontend test suite**

Run: `pnpm exec vitest run`
Expected: all tests PASS, including `src/lib/components/ReviewTab.test.ts` (check it still passes -- if it directly asserted anything about `PhaseTable`'s old no-props rendering, update that assertion minimally to account for the new real data path; if it doesn't touch `PhaseTable` at all, no change needed).

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/PhaseTable.svelte src/lib/components/PhaseTable.test.ts src/lib/components/ReviewTab.svelte src/lib/game/mock-data.ts src/lib/game/mock-data.test.ts
git commit -m "feat(phase): wire real phase accuracy into PhaseTable, remove mocked PHASE_ROWS"
```

---

### Task 4: Full verification pass

**Files:**
- Modify only if verification exposes a defect: the smallest file already named in Tasks 1-3.

**Interfaces:**
- No new interfaces. This task proves the implementation works end-to-end and doesn't regress anything else.

- [ ] **Step 1: Run the complete automated verification matrix**

```bash
pnpm exec vitest run
pnpm check
pnpm lint
pnpm build
```

Expected:
- Vitest: all tests PASS.
- Svelte check: `0 errors`; pre-existing unrelated warnings (a11y, `app-region`, `state_referenced_locally` -- the same categories every prior iteration's ledger has recorded) are permitted but must be reported.
- ESLint: exit `0`.
- Vite build: exit `0`.

No `cargo test` step -- this plan makes no Rust changes.

- [ ] **Step 2: Commit only if verification required a correction**

If no correction was required, do not create an empty commit. If a correction was required, stage only the relevant files and commit:

```bash
git commit -m "fix: satisfy phase rating verification"
```

Then rerun the entire Step 1 matrix after the final code change.

- [ ] **Step 3: Note the manual GUI check for the user**

This plan's automated verification cannot visually confirm the Phase table's real badges/tooltips in a running app (this sandbox is headless, consistent with every prior iteration's ledger note). Record in the final report that the user should run `pnpm exec tauri dev`, load a real game, open the Review tab, and confirm: 3 phase rows render with real (non-mock) badges, hovering a badge shows the exact accuracy percentage in a native tooltip, and a very short game (e.g. a checkmate in a handful of moves, never reaching the material-based endgame threshold) shows a `—` placeholder for Endgame instead of a fabricated badge.
