import { describe, it, expect } from 'vitest';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
import { MOCK_POSITIONS } from './mock-data';

describe('positionToFen', () => {
	it('serializes the standard starting position', () => {
		expect(positionToFen(MOCK_POSITIONS[0], 'w', 1)).toBe(
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		);
	});

	it('serializes the position after 1.e4 with Black to move', () => {
		expect(positionToFen(MOCK_POSITIONS[1], 'b', 1)).toBe(
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
		expect(moveToSan(MOCK_POSITIONS[13], { from: 'c8', to: 'g4' })).toBe('Bg4');
	});

	it('renders a non-capturing knight move (matches BEST_MOVES[30])', () => {
		expect(moveToSan(MOCK_POSITIONS[29], { from: 'f6', to: 'g4' })).toBe('Ng4');
	});

	it('renders a pawn capture with the from-file prefix', () => {
		// SAN_LIST[21] = 'fxe6': before this move (MOCK_POSITIONS[21]), White's
		// bishop sits on e6 (just played Bxe6) and Black's f7 pawn can recapture.
		expect(moveToSan(MOCK_POSITIONS[21], { from: 'f7', to: 'e6' })).toBe('fxe6');
	});
});
