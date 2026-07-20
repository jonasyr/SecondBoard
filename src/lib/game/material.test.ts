import { describe, it, expect } from 'vitest';
import { materialForColor, isMaterialSacrifice } from './material';
import type { Position } from '$lib/board/types';

describe('materialForColor', () => {
	it('sums standard piece values for one side, ignoring the king', () => {
		const position: Position = {
			e1: ['K', 'w'],
			d1: ['Q', 'w'],
			a1: ['R', 'w'],
			h1: ['R', 'w'],
			c1: ['B', 'w'],
			b1: ['N', 'w'],
			a2: ['P', 'w'],
			e8: ['K', 'b']
		};
		// Q(9) + R(5) + R(5) + B(3) + N(3) + P(1) = 26; king contributes 0.
		expect(materialForColor(position, 'w')).toBe(26);
		expect(materialForColor(position, 'b')).toBe(0);
	});

	it('returns 0 for a side with no pieces on the board', () => {
		const position: Position = { e1: ['K', 'w'] };
		expect(materialForColor(position, 'b')).toBe(0);
	});
});

describe('isMaterialSacrifice', () => {
	it('is true when the mover gives up a piece worth 3+ points net, relative to the opponent', () => {
		// White has a knight on e5 that simply vanishes (given away) -- no
		// White capture compensates, and Black's material is unchanged.
		const before: Position = {
			e1: ['K', 'w'],
			e5: ['N', 'w'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(true);
	});

	it('is false for an even trade (capturing a piece of equal value)', () => {
		// White's bishop captures Black's bishop: White's own material is
		// unchanged, Black's material drops by 3 -- the DIFFERENTIAL (mover
		// minus opponent) goes up, not down, so this is not a sacrifice.
		const before: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			f7: ['B', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			f7: ['B', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});

	it('is false for a small material swing under the 3-point sacrifice threshold', () => {
		// White's pawn captures Black's pawn: only a 1-point swing.
		const before: Position = {
			e1: ['K', 'w'],
			d4: ['P', 'w'],
			e5: ['P', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e5: ['P', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});
});
