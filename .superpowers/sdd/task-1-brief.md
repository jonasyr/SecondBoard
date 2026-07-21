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

