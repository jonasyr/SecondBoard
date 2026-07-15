import { describe, it, expect } from 'vitest';
import { diffMove } from './diff-move';
import type { Position } from './types';

describe('diffMove', () => {
	it('detects a simple pawn push', () => {
		const prev: Position = { e2: ['P', 'w'] };
		const cur: Position = { e4: ['P', 'w'] };
		expect(diffMove(prev, cur)).toEqual({ from: 'e2', to: 'e4' });
	});

	it('detects the moving piece robustly across a capture (extra square vacated by the captured piece)', () => {
		// White knight f3 captures a black pawn on e5.
		const prev: Position = { f3: ['N', 'w'], e5: ['P', 'b'] };
		const cur: Position = { e5: ['N', 'w'] };
		expect(diffMove(prev, cur)).toEqual({ from: 'f3', to: 'e5' });
	});

	it('picks the king (primary traveller) for castling by matching piece identity', () => {
		// White kingside castle: Ke1-g1, Rh1-f1.
		const prev: Position = { e1: ['K', 'w'], h1: ['R', 'w'] };
		const cur: Position = { g1: ['K', 'w'], f1: ['R', 'w'] };
		const result = diffMove(prev, cur);
		expect(result).not.toBeNull();
		expect(['e1', 'h1']).toContain(result!.from);
		expect(['g1', 'f1']).toContain(result!.to);
		// The matched pair must carry the same piece identity.
		expect(prev[result!.from]).toEqual(cur[result!.to]);
	});

	it('returns null when there is no change', () => {
		const pos: Position = { e4: ['P', 'w'] };
		expect(diffMove(pos, pos)).toBeNull();
	});

	it('returns null when either position has no vacated/occupied squares to pair', () => {
		expect(diffMove({}, {})).toBeNull();
	});
});
