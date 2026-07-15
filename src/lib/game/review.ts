/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262),
 * ported to plain functions operating on the mock data in ./mock-data.
 * Feeds real Rust analysis/pgn output in later iterations without changing
 * callers (README §8; LOGIC.md §7).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES } from '$lib/tokens';
import {
	BEST_MOVES,
	COACH_TEXT_MAP,
	EVAL_PER_PLY,
	CLASS_CODES,
	MOCK_MOVE_META,
	MOCK_POSITIONS,
	PLAYERS,
	SAN_LIST
} from './mock-data';

export interface ReviewPly {
	position: Position;
	lastMove: Move | null;
	classCode: ClassCode | null;
	best: (Move & { san: string }) | null;
	evalNum: number;
	evalStr: string;
	whitePct: number;
	coachMove: string;
	coachText: string;
}

const INTRO_COACH_TEXT =
	'The game begins. Step through with the arrows or arrow keys to see every move classified.';

/**
 * Derives everything the Game Review screen needs to render a given ply:
 * the resulting position, the move that produced it, its classification,
 * the engine's suggested alternative (when the played move wasn't best),
 * the eval bar/number, and the coach card's move label + commentary.
 *
 * Mirrors the reference's renderVals() (lines 1221-1234, 1237-1239, 1325-1326),
 * with one deliberate simplification: the reference internally defaults
 * `selCode` to `'book'` at ply 0 purely so its `selCls` lookup (glyph/color/
 * word for board-square badges, out of scope for this data layer) doesn't
 * throw; every actual use of `selCode` at ply 0 is already gated behind
 * `ply > 0` (coachText, `best`), so the observable classification at ply 0
 * is exposed here as `null` per this module's own ReviewPly contract.
 */
export function getReviewPly(ply: number): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMove = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;

	const evalNum = EVAL_PER_PLY[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (BEST_MOVES[ply] ?? null) : null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + SAN_LIST[ply - 1] : 'Start';
	const coachText = ply > 0 && classCode ? COACH_TEXT_MAP[classCode] : INTRO_COACH_TEXT;

	return {
		position,
		lastMove,
		classCode,
		best,
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}

export interface PlayerRowData {
	name: string;
	rating: string;
	initial: string;
	isWhite: boolean;
	clock: string;
	clockActive: boolean;
	captured: Array<{ color: 'w' | 'b'; type: 'P' | 'N' | 'B' | 'R' | 'Q' }>;
	adv: string | null;
}

/**
 * Derives the two player-row descriptors (captured material, material
 * advantage chip, active clock) for a given ply, swapped top/bottom by the
 * `flipped` board orientation. Mirrors renderVals() lines 1244-1258.
 */
export function getPlayerRows(
	ply: number,
	flipped: boolean
): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = MOCK_POSITIONS[ply];
	const cap = capturedInfo(position);
	const blackToMove = ply % 2 === 1;

	const white: PlayerRowData = {
		name: PLAYERS.white.name,
		rating: PLAYERS.white.rating,
		initial: PLAYERS.white.initial,
		isWhite: true,
		clock: PLAYERS.white.clock,
		clockActive: !blackToMove,
		captured: cap.whiteCap,
		adv: cap.adv > 0 ? '+' + cap.adv : null
	};
	const black: PlayerRowData = {
		name: PLAYERS.black.name,
		rating: PLAYERS.black.rating,
		initial: PLAYERS.black.initial,
		isWhite: false,
		clock: PLAYERS.black.clock,
		clockActive: blackToMove,
		captured: cap.blackCap,
		adv: cap.adv < 0 ? '+' + -cap.adv : null
	};

	const whiteAtBottom = !flipped;
	return whiteAtBottom ? { top: black, bottom: white } : { top: white, bottom: black };
}
