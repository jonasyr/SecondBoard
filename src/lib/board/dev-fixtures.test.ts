import { describe, it, expect } from 'vitest';
import { DEV_GAME } from './dev-fixtures';

describe('DEV_GAME (temporary mock fixture, Iteration 3 visual QA only)', () => {
	it('has 32 positions (ply 0 through 31) for the 31-half-move sample game', () => {
		expect(DEV_GAME.positions).toHaveLength(32);
	});

	it('has the standard starting position at ply 0', () => {
		expect(DEV_GAME.positions[0].e2).toEqual(['P', 'w']);
		expect(DEV_GAME.positions[0].e7).toEqual(['P', 'b']);
		expect(Object.keys(DEV_GAME.positions[0])).toHaveLength(32);
	});

	it('reflects 1.e4 after ply 1 (pawn moved from e2 to e4)', () => {
		expect(DEV_GAME.positions[1].e4).toEqual(['P', 'w']);
		expect(DEV_GAME.positions[1].e2).toBeUndefined();
	});

	it('has 31 move-meta entries aligned to the 31 plies', () => {
		expect(DEV_GAME.meta).toHaveLength(31);
		expect(DEV_GAME.meta[0]).toEqual({ from: 'e2', to: 'e4' });
	});

	it('has a classification code and eval per ply, aligned to the sample data', () => {
		expect(DEV_GAME.classCodes).toHaveLength(31);
		expect(DEV_GAME.classCodes[30]).toBe('brilliant'); // ply 31's move (16.Ne5)
		expect(DEV_GAME.evalPerPly).toHaveLength(32);
	});

	it('exposes the two best-move entries where the played move was not best', () => {
		expect(DEV_GAME.bestMoves[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
		expect(DEV_GAME.bestMoves[30]).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' });
	});
});
