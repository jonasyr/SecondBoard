import { describe, it, expect } from 'vitest';
import { materialForColor } from './material';
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
