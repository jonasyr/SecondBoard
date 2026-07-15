/**
 * Board domain types. Position shape mirrors the mock engine documented in
 * design_handoff_secondboard/reference/logic/chess-mock.js:
 *   positions[ply] = { <square>: [<pieceType>, <'w'|'b'>], ... }
 * The real Rust `pgn` module (Iteration 4+) emits the same shape (or a FEN
 * converted to this shape) per LOGIC.md §2.1.
 */

export type PieceColor = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

/** [type, color], e.g. ['N', 'w'] = white knight. */
export type Piece = [PieceType, PieceColor];

/** File+rank square id, e.g. 'e4'. */
export type Square = string;

/** A full board position: square id -> occupying piece (absent squares are empty). */
export type Position = Record<Square, Piece>;

/** A single move's origin/destination squares. */
export interface Move {
	from: Square;
	to: Square;
}
