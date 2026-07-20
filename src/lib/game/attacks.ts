/**
 * Pure, simplified attack-detection geometry used only as Brilliant's
 * "is this piece currently hanging" precondition (blueprint §4/§8's
 * `is_piece_sacrifice` guard). A real chess.com-style Brilliant is a piece
 * left ATTACKED (en prise) that's still fine for the mover whether or not the
 * opponent actually captures it -- e.g. the reference game's 11...Na4
 * (docs/references/DonaldByrne_RJamesFischer/), which is never captured at
 * all (White correctly declines). Detecting this requires an attack-square
 * query, not a diff of material across subsequent board snapshots (which can
 * only ever see a sacrifice the opponent actually accepts).
 *
 * Simplifications (explicitly out of scope, matching material.ts's own
 * no-SEE disclosure): no full legal-move generation (no check/pin awareness
 * -- a "pinned" attacker is still counted as an attacker here), no Static
 * Exchange Evaluation ordering or piece-value weighting among attackers/
 * defenders themselves. "Hanging" is defined purely as attacker COUNT
 * exceeding defender COUNT on the target square -- a piece defended once by
 * a queen against two pawn attackers is still flagged "hanging" under this
 * count-only heuristic, even though the value math may actually favor the
 * defender in a real exchange sequence.
 */
import type { Piece, PieceColor, Position, Square } from '$lib/board/types';

const FILES = 'abcdefgh';

function fileOf(sq: Square): number {
	return FILES.indexOf(sq[0]);
}

function rankOf(sq: Square): number {
	return Number(sq[1]);
}

function squareAt(file: number, rank: number): Square | null {
	if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
	return FILES[file] + rank;
}

const KNIGHT_OFFSETS: Array<[number, number]> = [
	[1, 2],
	[2, 1],
	[2, -1],
	[1, -2],
	[-1, -2],
	[-2, -1],
	[-2, 1],
	[-1, 2]
];

const KING_OFFSETS: Array<[number, number]> = [
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1],
	[0, -1],
	[1, -1]
];

const ORTHOGONAL_DIRS: Array<[number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];

const DIAGONAL_DIRS: Array<[number, number]> = [
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1]
];

function pieceAt(position: Position, file: number, rank: number): Piece | undefined {
	const sq = squareAt(file, rank);
	return sq ? position[sq] : undefined;
}

/**
 * Counts how many pieces of `byColor` currently attack `target` on this
 * board. Sliding pieces (rook/bishop/queen) are blocked by the first piece
 * encountered in each direction, exactly like real chess movement -- a piece
 * of the wrong type/color at that blocking square stops the ray entirely
 * (no attack from beyond it), matching how a blocked file/diagonal works.
 */
export function countAttackers(position: Position, target: Square, byColor: PieceColor): number {
	const tf = fileOf(target);
	const tr = rankOf(target);
	let count = 0;

	for (const [df, dr] of KNIGHT_OFFSETS) {
		const piece = pieceAt(position, tf + df, tr + dr);
		if (piece && piece[0] === 'N' && piece[1] === byColor) count++;
	}

	for (const [df, dr] of KING_OFFSETS) {
		const piece = pieceAt(position, tf + df, tr + dr);
		if (piece && piece[0] === 'K' && piece[1] === byColor) count++;
	}

	for (const [df, dr] of ORTHOGONAL_DIRS) {
		let f = tf + df;
		let r = tr + dr;
		while (true) {
			const piece = pieceAt(position, f, r);
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'R' || piece[0] === 'Q')) count++;
				break;
			}
			if (squareAt(f, r) === null) break;
			f += df;
			r += dr;
		}
	}

	for (const [df, dr] of DIAGONAL_DIRS) {
		let f = tf + df;
		let r = tr + dr;
		while (true) {
			const piece = pieceAt(position, f, r);
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'B' || piece[0] === 'Q')) count++;
				break;
			}
			if (squareAt(f, r) === null) break;
			f += df;
			r += dr;
		}
	}

	// A pawn of `byColor` attacks `target` if it sits diagonally "behind" it from the
	// capturing pawn's own point of view: a White pawn captures toward higher ranks, so an
	// attacking White pawn sits one rank BELOW target; a Black pawn captures toward lower
	// ranks, so an attacking Black pawn sits one rank ABOVE target.
	const pawnRankOffset = byColor === 'w' ? -1 : 1;
	for (const df of [-1, 1]) {
		const piece = pieceAt(position, tf + df, tr + pawnRankOffset);
		if (piece && piece[0] === 'P' && piece[1] === byColor) count++;
	}

	return count;
}

/**
 * True when the piece at `square` belongs to `ownerColor` and has strictly
 * more opposing attackers than same-color defenders on that square (see this
 * module's header comment for the count-only simplification).
 */
export function isPieceHanging(position: Position, square: Square, ownerColor: PieceColor): boolean {
	const piece = position[square];
	if (!piece || piece[1] !== ownerColor) return false;

	const opponent: PieceColor = ownerColor === 'w' ? 'b' : 'w';
	const attackers = countAttackers(position, square, opponent);
	if (attackers === 0) return false;

	const defenders = countAttackers(position, square, ownerColor);
	return attackers > defenders;
}
