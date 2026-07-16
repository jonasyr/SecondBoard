/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262).
 * Positions/moves/SAN now come from the real Rust `pgn` module's parse of
 * whatever game is loaded (`GameData`, Iteration 6) instead of a hardcoded
 * mock array. Move classification/coach text/best-move suggestions remain
 * mocked (CLASS_CODES/COACH_TEXT_MAP/BEST_MOVES in ./mock-data) and are
 * applied ONLY when `game.isSample` is true — i.e. the loaded PGN is
 * byte-identical to the one known sample game those mocks describe. A
 * genuinely different real pasted game gets real positions/moves but no
 * (rather than misleading) classification (README §11 step 6 scope).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, PieceColor, PieceType, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES } from '$lib/tokens';
import { BEST_MOVES, COACH_TEXT_MAP, EVAL_PER_PLY, CLASS_CODES, PLAYERS } from './mock-data';

export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}

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

export const UNCLASSIFIED_COACH_TEXT =
	"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview.";

/**
 * Derives everything the Game Review screen needs to render a given ply:
 * the resulting position, the move that produced it, its classification,
 * the engine's suggested alternative (when the played move wasn't best),
 * the eval bar/number, and the coach card's move label + commentary.
 *
 * Mirrors the reference's renderVals() (lines 1221-1234, 1237-1239, 1325-1326).
 */
export function getReviewPly(
	ply: number,
	game: GameData,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES
): ReviewPly {
	const position = game.positions[ply];
	const lastMove = ply > 0 ? game.moveMeta[ply - 1] : null;
	const classCode: ClassCode | null =
		ply > 0 && game.isSample ? (CLASS_CODES[ply - 1] ?? null) : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + game.sanList[ply - 1] : 'Start';
	const coachText =
		ply === 0 ? INTRO_COACH_TEXT : classCode ? COACH_TEXT_MAP[classCode] : UNCLASSIFIED_COACH_TEXT;

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
	captured: Array<{ color: PieceColor; type: PieceType }>;
	adv: string | null;
}

/**
 * Derives the two player-row descriptors (captured material, material
 * advantage chip, active clock) for a given ply, swapped top/bottom by the
 * `flipped` board orientation. Mirrors renderVals() lines 1244-1258. Player
 * name/rating/clock still come from the mocked `PLAYERS` (deliberately not
 * wired to real PGN tags this iteration — see the plan's Global Constraints).
 */
export function getPlayerRows(
	ply: number,
	flipped: boolean,
	game: GameData
): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = game.positions[ply];
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
