import { describe, it, expect } from 'vitest';
import { buildBoardSquares } from './build-squares';
import type { Position } from './types';

const EMPTY: Position = {};
const ONE_PAWN: Position = { e4: ['P', 'w'] };

describe('buildBoardSquares', () => {
	it('returns exactly 64 squares', () => {
		expect(buildBoardSquares(EMPTY)).toHaveLength(64);
	});

	it('orders squares a8..h8, a7..h7, ... a1..h1 when unflipped (first square is a8)', () => {
		const squares = buildBoardSquares(EMPTY);
		expect(squares[0].id).toBe('a8');
		expect(squares[7].id).toBe('h8');
		expect(squares[63].id).toBe('h1');
	});

	it('reverses to h1..a1, h2..a2, ... h8..a8 when flipped (first square is h1)', () => {
		const squares = buildBoardSquares(EMPTY, { flipped: true });
		expect(squares[0].id).toBe('h1');
		expect(squares[63].id).toBe('a8');
	});

	it('marks a1 as a dark square and a8 as a light square (parity (f+r)%2===1 => dark)', () => {
		const squares = buildBoardSquares(EMPTY);
		const a1 = squares.find((s) => s.id === 'a1')!;
		const a8 = squares.find((s) => s.id === 'a8')!;
		expect(a1.isDark).toBe(true);
		expect(a8.isDark).toBe(false);
	});

	it('attaches the occupying piece to its square, and null elsewhere', () => {
		const squares = buildBoardSquares(ONE_PAWN);
		const e4 = squares.find((s) => s.id === 'e4')!;
		const e5 = squares.find((s) => s.id === 'e5')!;
		expect(e4.piece).toEqual(['P', 'w']);
		expect(e5.piece).toBeNull();
	});

	it('flags both the from and to squares of the last move as isLast', () => {
		const squares = buildBoardSquares(EMPTY, { lastSquares: ['e2', 'e4'] });
		expect(squares.find((s) => s.id === 'e2')!.isLast).toBe(true);
		expect(squares.find((s) => s.id === 'e4')!.isLast).toBe(true);
		expect(squares.find((s) => s.id === 'd4')!.isLast).toBe(false);
	});

	it('flags only the given square as brilliant', () => {
		const squares = buildBoardSquares(EMPTY, { brilliantSquare: 'e5' });
		expect(squares.find((s) => s.id === 'e5')!.isBrilliant).toBe(true);
		expect(squares.find((s) => s.id === 'd5')!.isBrilliant).toBe(false);
	});

	it('places the badge glyph/color only on the badge square', () => {
		const squares = buildBoardSquares(EMPTY, {
			badge: { square: 'g4', glyph: '★', color: '#4ADEA0' }
		});
		const g4 = squares.find((s) => s.id === 'g4')!;
		expect(g4.hasBadge).toBe(true);
		expect(g4.badgeGlyph).toBe('★');
		expect(g4.badgeColor).toBe('#4ADEA0');
		const other = squares.find((s) => s.id === 'g3')!;
		expect(other.hasBadge).toBe(false);
		expect(other.badgeGlyph).toBe('');
	});

	it('shows rank labels only on the left-most file (unflipped) and file labels only on the bottom-most rank', () => {
		const squares = buildBoardSquares(EMPTY);
		expect(squares.find((s) => s.id === 'a5')!.rankLabel).toBe('5');
		expect(squares.find((s) => s.id === 'b5')!.rankLabel).toBe('');
		expect(squares.find((s) => s.id === 'c1')!.fileLabel).toBe('c');
		expect(squares.find((s) => s.id === 'c2')!.fileLabel).toBe('');
	});

	it('flips which edge shows coordinate labels when flipped', () => {
		const squares = buildBoardSquares(EMPTY, { flipped: true });
		expect(squares.find((s) => s.id === 'h5')!.rankLabel).toBe('5');
		expect(squares.find((s) => s.id === 'a5')!.rankLabel).toBe('');
		expect(squares.find((s) => s.id === 'c8')!.fileLabel).toBe('c');
		expect(squares.find((s) => s.id === 'c1')!.fileLabel).toBe('');
	});
});
