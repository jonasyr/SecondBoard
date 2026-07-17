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
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}

export interface ReviewPly {
	position: Position;
	lastMove: Move | null;
	classCode: ClassCode | null;
	best: (Move & { san: string }) | null;
	nextBest: (Move & { san: string }) | null;
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

	// Retrospective "best was" text (CoachCard): only surfaced when the played
	// move was one of the NOT_BEST classifications and mock data has an entry.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

	// Prospective board arrow: the engine's top suggestion computed FROM the
	// position currently on screen, for whichever move comes next -- always
	// shown when available, independent of classCode/isSample (real engine
	// analysis applies to every loaded game, not just the sample one).
	const nextBest = bestMoves[ply + 1] ?? null;

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
		nextBest,
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
 * name/rating come from the real PGN White/Black/*Elo tags when present,
 * falling back to the mocked `PLAYERS` fixture otherwise; clock remains mock
 * (no live clock data exists for a completed game review).
 */
export function getPlayerRows(
	ply: number,
	flipped: boolean,
	game: GameData
): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = game.positions[ply];
	const cap = capturedInfo(position);
	const blackToMove = ply % 2 === 1;

	// Real PGN White/Black/*Elo tags take priority; the mock PLAYERS fixture is
	// only a fallback for games missing those tags (it also happens to match
	// the built-in sample game's own real tags, so its display is unaffected).
	const whiteName = game.whiteName ?? PLAYERS.white.name;
	const blackName = game.blackName ?? PLAYERS.black.name;
	const whiteRating = game.whiteRating ?? PLAYERS.white.rating;
	const blackRating = game.blackRating ?? PLAYERS.black.rating;

	const white: PlayerRowData = {
		name: whiteName,
		rating: whiteRating,
		initial: whiteName.charAt(0).toUpperCase(),
		isWhite: true,
		clock: PLAYERS.white.clock,
		clockActive: !blackToMove,
		captured: cap.whiteCap,
		adv: cap.adv > 0 ? '+' + cap.adv : null
	};
	const black: PlayerRowData = {
		name: blackName,
		rating: blackRating,
		initial: blackName.charAt(0).toUpperCase(),
		isWhite: false,
		clock: PLAYERS.black.clock,
		clockActive: blackToMove,
		captured: cap.blackCap,
		adv: cap.adv < 0 ? '+' + -cap.adv : null
	};

	const whiteAtBottom = !flipped;
	return whiteAtBottom ? { top: black, bottom: white } : { top: white, bottom: black };
}
