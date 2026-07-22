import { describe, it, expect } from 'vitest';
import {
	CLASS_CODES,
	EVAL_PER_PLY,
	BEST_MOVES,
	COACH_TEXT_MAP,
	BREAKDOWN_ROWS,
	PLAYERS
} from './mock-data';

describe('mock-data', () => {
	it('CLASS_CODES/EVAL_PER_PLY have the sample game\'s known fixed lengths (31 plies)', () => {
		expect(CLASS_CODES).toHaveLength(31);
		expect(EVAL_PER_PLY).toHaveLength(32); // includes ply 0
	});

	it('has a coach text entry for every classification code', () => {
		for (const code of CLASS_CODES) {
			expect(COACH_TEXT_MAP[code]).toBeTruthy();
		}
	});

	it('has 10 breakdown rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
	});

	it('defines both players with a gameRating', () => {
		expect(PLAYERS.white.gameRating).toBe('1712');
		expect(PLAYERS.black.gameRating).toBe('1994');
	});

	it('has bestMoves entries matching the reference (ply 14 and 30)', () => {
		expect(BEST_MOVES[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
		expect(BEST_MOVES[30]).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' });
	});
});
