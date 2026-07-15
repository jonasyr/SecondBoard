import { describe, it, expect } from 'vitest';
import type { Piece, Position } from './types';

describe('board types', () => {
	it('Piece is a [type, color] tuple usable as a Position value', () => {
		const piece: Piece = ['N', 'w'];
		const position: Position = { g1: piece, e4: ['P', 'b'] };
		expect(position.g1[0]).toBe('N');
		expect(position.g1[1]).toBe('w');
		expect(position.e4).toEqual(['P', 'b']);
	});
});
