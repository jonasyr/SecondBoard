/**
 * Pure move/position notation helpers for the Phase-0 engine spike (LOGIC.md §7).
 * positionToFen intentionally omits castling rights/en-passant (both hardcoded to
 * '-') and the halfmove clock (hardcoded to 0) — the mock Position shape carries
 * none of that state, and full tracking arrives with the real shakmaty-based `pgn`
 * module in a later iteration. moveToSan is a minimal, non-disambiguating SAN
 * approximation used only to label engine best-move suggestions (see this plan's
 * Global Constraints).
 */
import type { Move, PieceColor, Position } from '$lib/board/types';

const FILES = 'abcdefgh';

export function positionToFen(
	position: Position,
	sideToMove: PieceColor,
	fullmoveNumber: number
): string {
	const rows: string[] = [];
	for (let rank = 8; rank >= 1; rank--) {
		let row = '';
		let empty = 0;
		for (let f = 0; f < 8; f++) {
			const piece = position[FILES[f] + rank];
			if (!piece) {
				empty++;
				continue;
			}
			if (empty > 0) {
				row += String(empty);
				empty = 0;
			}
			row += piece[1] === 'w' ? piece[0] : piece[0].toLowerCase();
		}
		if (empty > 0) row += String(empty);
		rows.push(row);
	}
	return `${rows.join('/')} ${sideToMove} - - 0 ${fullmoveNumber}`;
}

export function sideToMoveForPly(ply: number): PieceColor {
	return ply % 2 === 0 ? 'w' : 'b';
}

export function fullmoveNumberForPly(ply: number): number {
	return Math.floor(ply / 2) + 1;
}

export function moveToSan(position: Position, move: Move): string {
	const piece = position[move.from];
	const capture = Boolean(position[move.to]);
	if (!piece || piece[0] === 'P') {
		return capture ? `${move.from[0]}x${move.to}` : move.to;
	}
	return `${piece[0]}${capture ? 'x' : ''}${move.to}`;
}
