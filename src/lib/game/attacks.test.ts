import { describe, it, expect } from 'vitest';
import { countAttackers, isPieceHanging } from './attacks';
import type { Position } from '$lib/board/types';

describe('countAttackers', () => {
	it('counts a knight attacking the target square', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'b'], e8: ['K', 'b'] };
		// A knight on b5 attacks a3, c3, d4, d6, c7, a7 -- and d4 is one of those.
		expect(countAttackers(position, 'd4', 'b')).toBe(1);
	});

	it('does not count a knight that cannot reach the target square', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd5', 'b')).toBe(0); // adjacent, not a knight move
	});

	it('counts a king attacking an adjacent square', () => {
		const position: Position = { e1: ['K', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd8', 'b')).toBe(1); // adjacent (one file over)
		expect(countAttackers(position, 'd6', 'b')).toBe(0); // two ranks away, not adjacent
	});

	it('counts a rook attacking along an open file, blocked by an intervening piece', () => {
		const openFile: Position = { e1: ['K', 'w'], a4: ['R', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(openFile, 'a1', 'b')).toBe(1); // clear file, a4 sees a1

		const blockedFile: Position = {
			e1: ['K', 'w'],
			a4: ['R', 'b'],
			a2: ['P', 'w'], // blocks the file between a1 and a4
			e8: ['K', 'b']
		};
		expect(countAttackers(blockedFile, 'a1', 'b')).toBe(0);
	});

	it('counts a bishop attacking along an open diagonal, blocked by an intervening piece', () => {
		const openDiagonal: Position = { e1: ['K', 'w'], a8: ['B', 'b'], h1: ['K', 'b'] };
		expect(countAttackers(openDiagonal, 'd5', 'b')).toBe(1);

		const blockedDiagonal: Position = {
			e1: ['K', 'w'],
			a8: ['B', 'b'],
			c6: ['P', 'w'], // blocks the a8-h1 diagonal between a8 and d5
			h1: ['K', 'b']
		};
		expect(countAttackers(blockedDiagonal, 'd5', 'b')).toBe(0);
	});

	it('counts a queen attacking both orthogonally and diagonally', () => {
		const position: Position = { e1: ['K', 'w'], d4: ['Q', 'b'], h8: ['K', 'b'] };
		expect(countAttackers(position, 'd8', 'b')).toBe(1); // orthogonal (file)
		expect(countAttackers(position, 'a1', 'b')).toBe(1); // diagonal
	});

	it('counts a white pawn attacking diagonally forward (toward higher ranks)', () => {
		const position: Position = { e1: ['K', 'w'], d4: ['P', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'e5', 'w')).toBe(1);
		expect(countAttackers(position, 'c5', 'w')).toBe(1);
		expect(countAttackers(position, 'd5', 'w')).toBe(0); // straight ahead, not a pawn CAPTURE square
		expect(countAttackers(position, 'e3', 'w')).toBe(0); // behind the pawn, not attacked
	});

	it('counts a black pawn attacking diagonally forward (toward lower ranks)', () => {
		const position: Position = { e1: ['K', 'w'], d5: ['P', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'e4', 'b')).toBe(1);
		expect(countAttackers(position, 'c4', 'b')).toBe(1);
		expect(countAttackers(position, 'd4', 'b')).toBe(0);
	});

	it('sums multiple simultaneous attackers of the same color', () => {
		const position: Position = {
			e1: ['K', 'w'],
			a4: ['R', 'b'], // attacks a1 along the open a-file (orthogonal)
			h8: ['B', 'b'], // attacks a1 along the open a1-h8 diagonal
			e8: ['K', 'b']
		};
		expect(countAttackers(position, 'a1', 'b')).toBe(2);
	});

	it('does not count a piece of the wrong color', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd4', 'b')).toBe(0); // the knight is White, not Black
	});

	it('does not crash for targets near the edge of the board', () => {
		const position: Position = { e1: ['K', 'w'], b2: ['N', 'b'], e8: ['K', 'b'] };
		expect(() => countAttackers(position, 'a1', 'b')).not.toThrow();
		expect(countAttackers(position, 'a1', 'b')).toBe(0);
	});
});

describe('isPieceHanging', () => {
	it('is true when a piece has more attackers than defenders', () => {
		// A black queen on a8 attacks a4 along the open a-file; White's knight on a4 has no
		// defenders at all -- this mirrors the reference game's 11...Na4 (declined sacrifice,
		// never actually captured, yet still a genuine hanging piece by this count-only check).
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(true);
	});

	it('is false when attackers and defenders are equal in count', () => {
		const position: Position = {
			e1: ['K', 'w'],
			a4: ['N', 'w'],
			a1: ['R', 'w'], // defends a4 along the file
			a8: ['Q', 'b'], // attacks a4 along the file
			e8: ['K', 'b']
		};
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when there are no attackers at all', () => {
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'w'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when the square holds no piece', () => {
		const position: Position = { e1: ['K', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when the square holds a piece of the wrong color for the given owner', () => {
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'b'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false); // the piece there is Black's, not White's
	});
});
