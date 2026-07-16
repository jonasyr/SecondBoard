import { describe, it, expect } from 'vitest';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
import type { Position } from '$lib/board/types';

const startingPosition: Position = {
	a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], d1: ['Q', 'w'], e1: ['K', 'w'], f1: ['B', 'w'], g1: ['N', 'w'], h1: ['R', 'w'],
	a2: ['P', 'w'], b2: ['P', 'w'], c2: ['P', 'w'], d2: ['P', 'w'], e2: ['P', 'w'], f2: ['P', 'w'], g2: ['P', 'w'], h2: ['P', 'w'],
	a7: ['P', 'b'], b7: ['P', 'b'], c7: ['P', 'b'], d7: ['P', 'b'], e7: ['P', 'b'], f7: ['P', 'b'], g7: ['P', 'b'], h7: ['P', 'b'],
	a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], d8: ['Q', 'b'], e8: ['K', 'b'], f8: ['B', 'b'], g8: ['N', 'b'], h8: ['R', 'b']
};

// After 1.e4 (white pawn e2 -> e4)
const afterE4: Position = { ...startingPosition, e4: ['P', 'w'] };
delete afterE4.e2;

describe('positionToFen', () => {
	it('serializes the standard starting position', () => {
		expect(positionToFen(startingPosition, 'w', 1)).toBe(
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		);
	});

	it('serializes the position after 1.e4 with Black to move', () => {
		expect(positionToFen(afterE4, 'b', 1)).toBe(
			'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1'
		);
	});
});

describe('sideToMoveForPly / fullmoveNumberForPly', () => {
	it('alternates side to move starting with White at ply 0', () => {
		expect(sideToMoveForPly(0)).toBe('w');
		expect(sideToMoveForPly(1)).toBe('b');
		expect(sideToMoveForPly(2)).toBe('w');
	});

	it('increments the fullmove number every two plies', () => {
		expect(fullmoveNumberForPly(0)).toBe(1);
		expect(fullmoveNumberForPly(1)).toBe(1);
		expect(fullmoveNumberForPly(2)).toBe(2);
		expect(fullmoveNumberForPly(3)).toBe(2);
	});
});

describe('moveToSan', () => {
	it('renders a non-capturing bishop move (matches BEST_MOVES[14])', () => {
		const position: Position = { c8: ['B', 'b'] };
		expect(moveToSan(position, { from: 'c8', to: 'g4' })).toBe('Bg4');
	});

	it('renders a non-capturing knight move (matches BEST_MOVES[30])', () => {
		const position: Position = { f6: ['N', 'b'] };
		expect(moveToSan(position, { from: 'f6', to: 'g4' })).toBe('Ng4');
	});

	it('renders a pawn capture with the from-file prefix', () => {
		// A black pawn on f7 capturing a white piece sitting on e6.
		const position: Position = { f7: ['P', 'b'], e6: ['B', 'w'] };
		expect(moveToSan(position, { from: 'f7', to: 'e6' })).toBe('fxe6');
	});
});
