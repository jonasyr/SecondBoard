import { describe, it, expect } from 'vitest';
import { classifyMoveByEpLoss, classifyGame } from './classify';

describe('classifyMoveByEpLoss', () => {
	it('classifies exactly 0 loss as best', () => {
		expect(classifyMoveByEpLoss(0)).toBe('best');
	});

	it('classifies the upper edge of each band using Chess.com\'s exact published cutoffs', () => {
		expect(classifyMoveByEpLoss(2)).toBe('excellent');
		expect(classifyMoveByEpLoss(5)).toBe('good');
		expect(classifyMoveByEpLoss(10)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(20)).toBe('mistake');
	});

	it('classifies just above each cutoff as the next-worse band', () => {
		expect(classifyMoveByEpLoss(0.01)).toBe('excellent');
		expect(classifyMoveByEpLoss(2.01)).toBe('good');
		expect(classifyMoveByEpLoss(5.01)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(10.01)).toBe('mistake');
		expect(classifyMoveByEpLoss(20.01)).toBe('blunder');
	});

	it('classifies a large loss as blunder', () => {
		expect(classifyMoveByEpLoss(100)).toBe('blunder');
	});

	it('treats a negative loss (win% improved) the same as zero loss: best', () => {
		expect(classifyMoveByEpLoss(-5)).toBe('best');
	});
});

describe('classifyGame', () => {
	it('returns one classification per move, best when the mover\'s win% never worsens', () => {
		// ply0 (start, eval 0) -> ply1 White moves to +1.0 (better for White) ->
		// ply2 Black moves to +0.5 (better for Black, relative to +1.0).
		const codes = classifyGame([0, 1, 0.5]);
		expect(codes).toEqual(['best', 'best']);
	});

	it('classifies a real blunder: White drops from dead-even to badly losing', () => {
		// White's own win% swing from evalPerPly[0]=0 to evalPerPly[1]=-8 is far
		// more than 20 points, so ply 1 (White's move) is a blunder.
		const codes = classifyGame([0, -8]);
		expect(codes).toEqual(['blunder']);
	});

	it('returns an empty array for fewer than 2 eval samples', () => {
		expect(classifyGame([0])).toEqual([]);
		expect(classifyGame([])).toEqual([]);
	});

	it('attributes each ply\'s classification to the correct mover (White odd ply positions, Black even)', () => {
		// ply1 White: 0 -> 1 (improves, best). ply2 Black: 1 -> -1 (Black's own
		// POV win% at eval -1 is much better for Black than at eval 1, so also
		// best for Black). ply3 White: -1 -> -9 (a big drop in White's own win%
		// -> blunder for White).
		const codes = classifyGame([0, 1, -1, -9]);
		expect(codes[0]).toBe('best'); // White's move 1
		expect(codes[1]).toBe('best'); // Black's move 1
		expect(codes[2]).toBe('blunder'); // White's move 2
	});

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
});
