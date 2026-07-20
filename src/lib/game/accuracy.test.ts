import { describe, it, expect } from 'vitest';
import { winPercentFromEval, winPercentFromWdl, winPercentForPly, computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';

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

describe('computeGameAccuracy', () => {
	it('returns null for both sides when there are fewer than 2 eval samples', () => {
		expect(computeGameAccuracy([0])).toEqual({ white: null, black: null });
		expect(computeGameAccuracy([])).toEqual({ white: null, black: null });
	});

	it('gives exactly 100 to both sides when the eval never worsens for the mover', () => {
		// ply0 (start, eval 0) -> ply1 white moves to +1.0 (good for White) ->
		// ply2 black moves to +0.5 (good for Black, since it's an improvement
		// for Black relative to +1.0). lichess's fromWinPercents returns a
		// literal 100 (not just close to it) whenever win% doesn't worsen.
		const { white, black } = computeGameAccuracy([0, 1, 0.5]);
		expect(white).toBe(100);
		expect(black).toBe(100);
	});

	it('penalizes a mover whose eval swings against them, and blends their volatility-weighted mean with their harmonic mean', () => {
		// White plays two moves that each worsen White's eval (0 -> -3, -3.2 -> -8);
		// Black plays two moves that each slightly improve Black's eval (-3 -> -3.2, -8 -> -8.5).
		const { white, black } = computeGameAccuracy([0, -3, -3.2, -8, -8.5]);
		expect(white).toBeCloseTo(37.3255159268525, 9);
		expect(black).toBe(100);
	});

	it('gives a lone mover (no moves yet for the other side) a real score while the other side stays null', () => {
		// Only White has moved (evalPerPly length 2); Black made no move yet.
		const { white, black } = computeGameAccuracy([0, 1]);
		expect(white).toBe(100);
		expect(black).toBeNull();
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

describe('estimatePerformanceRating', () => {
	it('applies the (accuracy - 64) * 100 fit', () => {
		expect(estimatePerformanceRating(93.2)).toBe(2920);
		expect(estimatePerformanceRating(82.6)).toBe(1860);
		expect(estimatePerformanceRating(64)).toBe(100); // exactly 0 before the floor clamp
	});

	it('rounds to the nearest integer rating', () => {
		expect(estimatePerformanceRating(89.756)).toBe(2576);
	});

	it('clamps at a 100 floor instead of going negative for low accuracy', () => {
		expect(estimatePerformanceRating(50)).toBe(100);
		expect(estimatePerformanceRating(0)).toBe(100);
	});

	it('returns null when accuracy is null, rather than fabricating a number', () => {
		expect(estimatePerformanceRating(null)).toBeNull();
	});
});
