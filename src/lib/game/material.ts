/**
 * Pure, no-SEE material accounting used only as Brilliant's sacrifice
 * precondition (blueprint §4/§8's `is_piece_sacrifice` guard, simplified:
 * no search-continuation lookahead, just the raw material swing between two
 * given board snapshots).
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
 * True when the mover's material lead over the opponent (their material
 * minus the opponent's) drops by at least a minor piece's worth (3 points)
 * between the two given board snapshots. An even or favorable trade
 * (capturing a piece of equal or greater value) does not count -- only a
 * net material loss counts as a sacrifice.
 *
 * This function only diffs the two positions it's given -- it has no notion
 * of "before/after a move" or "before/after a reply" itself. Choosing which
 * two snapshots to compare (the position immediately before/after the
 * mover's own move, vs. a wider window that also spans the opponent's next
 * reply, to catch a piece deliberately left en prise) is entirely the
 * caller's responsibility; see classify.ts's `classifySpecial` for how it
 * picks (and validates) that window.
 */
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean {
	const opponent: PieceColor = mover === 'w' ? 'b' : 'w';
	const diffBefore = materialForColor(before, mover) - materialForColor(before, opponent);
	const diffAfter = materialForColor(after, mover) - materialForColor(after, opponent);
	return diffAfter - diffBefore <= -3;
}
