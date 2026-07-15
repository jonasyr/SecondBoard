import { describe, it, expect } from 'vitest';
import { PIECE_SPRITES } from './pieces';

describe('PIECE_SPRITES', () => {
	it('has exactly the 12 sprite keys, color+type, all resolving to a non-empty URL', () => {
		const expectedKeys = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
		expect(Object.keys(PIECE_SPRITES).sort()).toEqual(expectedKeys.sort());
		for (const key of expectedKeys) {
			expect(typeof PIECE_SPRITES[key as keyof typeof PIECE_SPRITES]).toBe('string');
			expect(PIECE_SPRITES[key as keyof typeof PIECE_SPRITES].length).toBeGreaterThan(0);
		}
	});
});
