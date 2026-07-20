/**
 * Pure, no-SEE material accounting used only as Brilliant's sacrifice
 * precondition (blueprint §4/§8's `is_piece_sacrifice` guard, simplified:
 * no search-continuation lookahead, just the raw material swing the mover's
 * own move caused, measured immediately before the opponent gets to reply).
 */
import type { Position, PieceColor, PieceType } from '$lib/board/types';

const PIECE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 0
};

/** Sums standard piece values for one side on a board (king excluded, value 0). */
export function materialForColor(position: Position, color: PieceColor): number {
	return Object.values(position)
		.filter(([, pieceColor]) => pieceColor === color)
		.reduce((sum, [type]) => sum + PIECE_VALUES[type], 0);
}

/**
 * True when the mover's own move dropped their material lead over the
 * opponent (their material minus the opponent's) by at least a minor
 * piece's worth (3 points), comparing the position immediately before the
 * move to the position immediately after it. An even or favorable trade
 * (capturing a piece of equal or greater value) does not count -- only a
 * move that gives up material net counts as a sacrifice.
 */
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean {
	const opponent: PieceColor = mover === 'w' ? 'b' : 'w';
	const diffBefore = materialForColor(before, mover) - materialForColor(before, opponent);
	const diffAfter = materialForColor(after, mover) - materialForColor(after, opponent);
	return diffAfter - diffBefore <= -3;
}
