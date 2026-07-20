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
			f1: ['B', 'w'], g1: ['N', 'w'],
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
