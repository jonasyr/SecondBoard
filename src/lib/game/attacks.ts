/**
 * Pure attack geometry and value-aware static exchange evaluation.
 *
 * `countAttackers` and `isPieceHanging` preserve the legacy count-based API,
 * while `staticExchangeGain` recursively evaluates capture sequences using
 * piece values and a freshly computed set of geometric attackers at each ply.
 *
 * This module does not generate legal moves or account for check, pins,
 * promotions, or en passant. A geometrically attacking piece is considered
 * available even when moving it would be illegal in a complete chess engine.
 */
import type { PieceColor, PieceType, Position, Square } from '$lib/board/types';

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

/**
 * Finds the squares of pieces of `byColor` that currently attack `target` on this
 * board. Sliding pieces (rook/bishop/queen) are blocked by the first piece
 * encountered in each direction, exactly like real chess movement -- a piece
 * of the wrong type/color at that blocking square stops the ray entirely
 * (no attack from beyond it), matching how a blocked file/diagonal works.
 */
export function findAttackers(
	position: Position,
	target: Square,
	byColor: PieceColor
): Square[] {
	const tf = fileOf(target);
	const tr = rankOf(target);
	const attackers: Square[] = [];

	for (const [df, dr] of KNIGHT_OFFSETS) {
		const square = squareAt(tf + df, tr + dr);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'N' && piece[1] === byColor) attackers.push(square);
	}
	for (const [df, dr] of KING_OFFSETS) {
		const square = squareAt(tf + df, tr + dr);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'K' && piece[1] === byColor) attackers.push(square);
	}

	for (const [df, dr] of ORTHOGONAL_DIRS) {
		let file = tf + df;
		let rank = tr + dr;
		while (true) {
			const square = squareAt(file, rank);
			if (!square) break;
			const piece = position[square];
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'R' || piece[0] === 'Q')) {
					attackers.push(square);
				}
				break;
			}
			file += df;
			rank += dr;
		}
	}
	for (const [df, dr] of DIAGONAL_DIRS) {
		let file = tf + df;
		let rank = tr + dr;
		while (true) {
			const square = squareAt(file, rank);
			if (!square) break;
			const piece = position[square];
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'B' || piece[0] === 'Q')) {
					attackers.push(square);
				}
				break;
			}
			file += df;
			rank += dr;
		}
	}

	const pawnRankOffset = byColor === 'w' ? -1 : 1;
	for (const df of [-1, 1]) {
		const square = squareAt(tf + df, tr + pawnRankOffset);
		const piece = square ? position[square] : undefined;
		if (square && piece?.[0] === 'P' && piece[1] === byColor) attackers.push(square);
	}
	return attackers;
}

export function countAttackers(
	position: Position,
	target: Square,
	byColor: PieceColor
): number {
	return findAttackers(position, target, byColor).length;
}

const EXCHANGE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 100
};

function opposite(color: PieceColor): PieceColor {
	return color === 'w' ? 'b' : 'w';
}

function captureOn(position: Position, from: Square, target: Square): Position {
	const next = { ...position };
	const attacker = next[from];
	if (!attacker) return next;
	delete next[from];
	next[target] = attacker;
	return next;
}

export function staticExchangeGain(
	position: Position,
	target: Square,
	byColor: PieceColor
): number {
	const targetPiece = position[target];
	if (!targetPiece || targetPiece[1] === byColor || targetPiece[0] === 'K') return 0;

	let best = 0;
	for (const attackerSquare of findAttackers(position, target, byColor)) {
		const next = captureOn(position, attackerSquare, target);
		const gain =
			EXCHANGE_VALUES[targetPiece[0]] - staticExchangeGain(next, target, opposite(byColor));
		best = Math.max(best, gain);
	}
	return best;
}

export function hasPositiveExchangeTarget(
	position: Position,
	ownerColor: PieceColor,
	minimumPieceValue = 3
): boolean {
	const opponent = opposite(ownerColor);
	return Object.entries(position).some(([square, piece]) => {
		if (piece[1] !== ownerColor || piece[0] === 'P' || piece[0] === 'K') return false;
		if (EXCHANGE_VALUES[piece[0]] < minimumPieceValue) return false;
		if (findAttackers(position, square, opponent).length === 0) return false;
		return staticExchangeGain(position, square, opponent) > 0;
	});
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
