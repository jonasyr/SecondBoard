/**
 * Pure standard chess piece values, reused wherever a move's material
 * significance needs checking (currently: classify.ts's Brilliant guard,
 * which combines a piece-value floor with attacks.ts's hanging-piece check
 * rather than this module's own former material-diff approach -- see git
 * history for Iteration 10/11's now-superseded `isMaterialSacrifice`).
 */
import type { Position, PieceColor, PieceType } from '$lib/board/types';

export const PIECE_VALUES: Record<PieceType, number> = {
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
