import { describe, it, expect } from 'vitest';
import { buildGame } from './mock-engine';

describe('buildGame', () => {
	it('produces one more position than the move count, starting from the standard array', () => {
		const { positions, meta } = buildGame(['e4', 'e5', 'Nf3']);
		expect(positions).toHaveLength(4);
		expect(meta).toHaveLength(3);
		expect(positions[0].e2).toEqual(['P', 'w']);
		expect(positions[1].e4).toEqual(['P', 'w']);
		expect(positions[1].e2).toBeUndefined();
		expect(meta[0]).toEqual({ from: 'e2', to: 'e4' });
	});

	it('handles castling by moving both king and rook', () => {
		const { positions } = buildGame(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
		const final = positions[positions.length - 1];
		expect(final.g1).toEqual(['K', 'w']);
		expect(final.f1).toEqual(['R', 'w']);
		expect(final.e1).toBeUndefined();
		expect(final.h1).toBeUndefined();
	});
});
