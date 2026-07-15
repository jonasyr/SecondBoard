/**
 * Pure from/to detector for the piece-slide animation, ported from the diff
 * portion of the reference's _animateMove() (LOGIC.md §2.4 steps 1-2).
 * Diffs two position maps and returns the square pair whose piece identity
 * matches (robust across captures, castling, promotions), falling back to
 * the first vacated/occupied pair if no identity match is found.
 */
import type { Move, Piece, Position } from './types';

function pieceEquals(a?: Piece, b?: Piece): boolean {
	return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

export function diffMove(prev: Position, cur: Position): Move | null {
	const keys = new Set<string>([...Object.keys(prev), ...Object.keys(cur)]);
	const froms: string[] = [];
	const tos: string[] = [];

	for (const key of keys) {
		const before = prev[key];
		const after = cur[key];
		if (before && !pieceEquals(before, after)) froms.push(key);
		if (after && !pieceEquals(before, after)) tos.push(key);
	}

	for (const to of tos) {
		const from = froms.find((candidate) => pieceEquals(prev[candidate], cur[to]));
		if (from) return { from, to };
	}

	if (froms.length && tos.length) return { from: froms[0], to: tos[0] };
	return null;
}
