/**
 * Piece-sprite registry. Each SVG is bundled offline via Vite's `?url&no-inline`
 * suffix (hashed static asset at build time — no runtime fetch), matching
 * the local-first/offline requirement (README §4.1, §9). Sprites are the
 * Cburnett-style set extracted verbatim into src/lib/board/pieces/.
 *
 * `&no-inline` is required (not just `?url`): all 12 sprites are under Vite's
 * default 4KB `assetsInlineLimit`, so a bare `?url` import still gets inlined
 * as a base64 data: URI in the JS bundle instead of emitted as a separate
 * hashed file — `&no-inline` forces the hashed-asset-file behavior the
 * comment above describes.
 */
import whiteKing from './pieces/white_king.svg?url&no-inline';
import whiteQueen from './pieces/white_queen.svg?url&no-inline';
import whiteRook from './pieces/white_rook.svg?url&no-inline';
import whiteBishop from './pieces/white_bishop.svg?url&no-inline';
import whiteKnight from './pieces/white_knight.svg?url&no-inline';
import whitePawn from './pieces/white_pawn.svg?url&no-inline';
import blackKing from './pieces/black_king.svg?url&no-inline';
import blackQueen from './pieces/black_queen.svg?url&no-inline';
import blackRook from './pieces/black_rook.svg?url&no-inline';
import blackBishop from './pieces/black_bishop.svg?url&no-inline';
import blackKnight from './pieces/black_knight.svg?url&no-inline';
import blackPawn from './pieces/black_pawn.svg?url&no-inline';

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
