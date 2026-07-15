/**
 * Piece-sprite registry. Each SVG is bundled offline via Vite's `?url`
 * suffix (hashed static asset at build time — no runtime fetch), matching
 * the local-first/offline requirement (README §4.1, §9). Sprites are the
 * Cburnett-style set extracted verbatim into src/lib/board/pieces/.
 */
import whiteKing from './pieces/white_king.svg?url';
import whiteQueen from './pieces/white_queen.svg?url';
import whiteRook from './pieces/white_rook.svg?url';
import whiteBishop from './pieces/white_bishop.svg?url';
import whiteKnight from './pieces/white_knight.svg?url';
import whitePawn from './pieces/white_pawn.svg?url';
import blackKing from './pieces/black_king.svg?url';
import blackQueen from './pieces/black_queen.svg?url';
import blackRook from './pieces/black_rook.svg?url';
import blackBishop from './pieces/black_bishop.svg?url';
import blackKnight from './pieces/black_knight.svg?url';
import blackPawn from './pieces/black_pawn.svg?url';

export const PIECE_SPRITES = {
	wK: whiteKing,
	wQ: whiteQueen,
	wR: whiteRook,
	wB: whiteBishop,
	wN: whiteKnight,
	wP: whitePawn,
	bK: blackKing,
	bQ: blackQueen,
	bR: blackRook,
	bB: blackBishop,
	bN: blackKnight,
	bP: blackPawn
} as const;

export type PieceSpriteKey = keyof typeof PIECE_SPRITES;
