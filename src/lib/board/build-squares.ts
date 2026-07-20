/**
 * Pure square-list builder, ported from the reference's buildBoard(pos, opts)
 * (design_handoff_secondboard/README.md §6.3, LOGIC.md §2.2). Returns a flat
 * 64-entry view-model list consumed by Board.svelte's {#each}. Note: the
 * reference's `psize` option is intentionally NOT ported — it is accepted
 * there but never wired into any generated style (verified against the
 * literal source); piece/square size is purely the grid cell size.
 */
import type { Piece, Position, Square } from './types';

const FILES = 'abcdefgh';

export interface BoardSquareVM {
	id: Square;
	file: number;
	rank: number;
	isDark: boolean;
	piece: Piece | null;
	isLast: boolean;
	isBrilliant: boolean;
	hasBadge: boolean;
	badgeGlyph: string;
	badgeColor: string;
	badgeIcon: string;
	badgeLabel: string;
	rankLabel: string;
	fileLabel: string;
}

export interface BuildBoardSquaresOptions {
	flipped?: boolean;
	/** [from, to] squares of the last move; both get the highlight tint. */
	lastSquares?: [Square, Square] | null;
	/** Destination square of a move classified 'brilliant'. */
	brilliantSquare?: Square | null;
	/** Classification badge, placed on its destination square only. */
	badge?: { square: Square; glyph: string; color: string; icon: string; label: string } | null;
}

export function buildBoardSquares(
	position: Position,
	opts: BuildBoardSquaresOptions = {}
): BoardSquareVM[] {
	const flipped = !!opts.flipped;
	const lastSquares = opts.lastSquares ?? null;
	const brilliantSquare = opts.brilliantSquare ?? null;
	const badge = opts.badge ?? null;

	const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
	const filesOrder = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

	const squares: BoardSquareVM[] = [];
	for (const r of ranks) {
		for (const f of filesOrder) {
			const id = FILES[f] + r;
			const piece = position[id] ?? null;
			const isDark = (f + r) % 2 === 1;
			const isLast = !!lastSquares && (lastSquares[0] === id || lastSquares[1] === id);
			const showRank = flipped ? f === 7 : f === 0;
			const showFile = flipped ? r === 8 : r === 1;
			const hasBadge = !!badge && badge.square === id;

			squares.push({
				id,
				file: f,
				rank: r,
				isDark,
				piece,
				isLast,
				isBrilliant: brilliantSquare === id,
				hasBadge,
				badgeGlyph: hasBadge ? badge!.glyph : '',
				badgeColor: hasBadge ? badge!.color : '',
				badgeIcon: hasBadge ? badge!.icon : '',
				badgeLabel: hasBadge ? badge!.label : '',
				rankLabel: showRank ? String(r) : '',
				fileLabel: showFile ? FILES[f] : ''
			});
		}
	}
	return squares;
}
