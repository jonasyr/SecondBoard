/**
 * Real per-move classification, replacing the fully-mocked CLASS_CODES
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §11) with
 * Chess.com's own published "Expected Points" cutoff table (Chess.com
 * support article, "How Are Moves Classified?"): a move's classification is
 * driven purely by how much win probability the mover lost by playing it,
 * relative to not losing any ground at all. Chess.com expresses this as
 * "expected points" on a 0-1 scale (Best 0.00 / Excellent <=0.02 / Good
 * <=0.05 / Inaccuracy <=0.10 / Mistake <=0.20 / Blunder >0.20); this module
 * uses win% on the 0-100 scale instead (identical up to a factor of 100),
 * since that's the scale `winPercentForPly` (accuracy.ts) already produces,
 * whether from the eval sigmoid or Stockfish's own WDL model — reusing it
 * keeps the win-probability math consistent between accuracy and
 * classification instead of introducing a second, slightly different
 * win-probability model.
 *
 * Scope note: Brilliant/Great/Miss (this file's `classifySpecial`) run before
 * the deterministic cutoff table, per Chess.com's own override order
 * (Brilliant > Great > Miss > cutoffs). Book and Forced remain a later
 * iteration (opening-book/ECO lookup and a dedicated ClassCode are both out
 * of scope here) -- see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
 */
import type { ClassCode } from '$lib/types';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
import { isPieceHanging } from './attacks';
import { PIECE_VALUES } from './material';

/** blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's
 * 0-100 win%-points scale (the blueprint's own numbers are on a 0-1 scale). */
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const BRILLIANT_MIN_SACRIFICE_VALUE = 3;
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 97; // recalibrated in Task 4 of this same plan
const MISS_WIN_BEFORE = 80;
const MISS_WIN_AFTER = 55;

/**
 * Optional real-game inputs that unlock the Brilliant/Great/Miss special
 * classes (blueprint §4/§8). Omitting this parameter entirely from
 * `classifyGame` reproduces its pre-existing (EP-cutoff-only) behavior
 * byte-for-byte -- every field here is used only to ADD classifications on
 * top of the deterministic cutoff table, never to change it.
 */
export interface SpecialClassInputs {
	/** One board position per ply (same shape/indexing as `GameData.positions`). */
	positions: Position[];
	/** The move actually played to reach ply `i + 1` (same shape as `GameData.moveMeta`). */
	moveMeta: Move[];
	/** The engine's suggested move FROM the position at ply `i - 1` TO reach ply `i`
	 * (same indexing as `RealAnalysis.bestMoves`/`AppState.bestMoves`). */
	bestMoves: Record<number, Move & { san: string }>;
	/** The engine's second-choice (MultiPV #2) win%-relevant data at the position
	 * BEFORE each ply, White-POV, same indexing as `evalPerPly`/`wdlPerPly`. */
	secondEvalPerPly?: (number | null)[];
	secondWdlPerPly?: (Wdl | null)[];
}

function secondLineWinPercent(
	ply: number,
	secondEvalPerPly?: (number | null)[],
	secondWdlPerPly?: (Wdl | null)[]
): number | null {
	const wdl = secondWdlPerPly?.[ply];
	if (wdl) return (wdl[0] + 0.5 * wdl[1]) / 10;
	const evalPawns = secondEvalPerPly?.[ply];
	if (evalPawns === null || evalPawns === undefined) return null;
	return 100 / (1 + Math.exp(-0.00368208 * (evalPawns * 100)));
}

/** Chess.com's own published Expected-Points cutoff table (support article,
 * verbatim), expressed in win% points (0-100) lost by the mover rather than
 * the 0-1 "expected points" scale the article uses — see this file's header
 * comment for why the two scales are equivalent here. A move that doesn't
 * worsen the mover's own win% at all (loss <= 0) is always Best. */
export function classifyMoveByEpLoss(epLossPoints: number): ClassCode {
	const loss = Math.max(0, epLossPoints);
	if (loss === 0) return 'best';
	if (loss <= 2) return 'excellent';
	if (loss <= 5) return 'good';
	if (loss <= 10) return 'inaccuracy';
	if (loss <= 20) return 'mistake';
	return 'blunder';
}

/**
 * Classifies every move of a game from its White-POV evalPerPly (one entry
 * per ply including the starting position, exactly the shape
 * engine-analysis.ts's loadRealAnalysis() produces). Returns one
 * classification per move: index `i` is the classification of ply `i + 1`
 * (the same indexing the mocked CLASS_CODES array already used, so callers
 * can swap one for the other without reshaping anything). Returns an empty
 * array when there isn't enough eval data yet (fewer than 2 samples) rather
 * than fabricating classifications from incomplete data.
 */
export function classifyGame(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	special?: SpecialClassInputs
): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const epLoss = beforePov - afterPov;

		codes.push(
			classifySpecial(ply, mover, beforePov, afterPov, epLoss, special) ??
				classifyMoveByEpLoss(epLoss)
		);
	}

	return codes;
}

/** Brilliant > Great > Miss (blueprint §4 override order, Book/Forced out of
 * scope this iteration). Returns null when no special condition applies and
 * no `special` argument was supplied at all -- falls through to the
 * deterministic EP-cutoff table in either case. */
function classifySpecial(
	ply: number,
	mover: 'w' | 'b',
	beforePov: number,
	afterPov: number,
	epLoss: number,
	special?: SpecialClassInputs
): ClassCode | null {
	if (!special) return null;

	const playedMove = special.moveMeta[ply - 1];
	const suggested = special.bestMoves[ply];
	const playedIsBest = Boolean(
		playedMove && suggested && suggested.from === playedMove.from && suggested.to === playedMove.to
	);
	const nearBest = epLoss <= 2 || playedIsBest;

	// A real sound sacrifice is a piece left ATTACKED that's still fine for the mover whether
	// or not the opponent actually takes it (e.g. the reference game's 11...Na4, never captured
	// at all -- White correctly declines). Checking the square the mover's own move landed on
	// for "is it currently hanging" (attacks.ts) catches this directly, unlike diffing
	// material across subsequent board snapshots, which can only ever see a sacrifice the
	// opponent actually accepts -- see docs/superpowers/plans/2026-07-20-iteration-12-attack-based-brilliant.md.
	const afterPosition = special.positions[ply];
	const playedPiece = playedMove && afterPosition ? afterPosition[playedMove.to] : undefined;
	const sacrificedValue = playedPiece ? PIECE_VALUES[playedPiece[0]] : 0;

	if (
		nearBest &&
		playedMove &&
		afterPosition &&
		sacrificedValue >= BRILLIANT_MIN_SACRIFICE_VALUE &&
		isPieceHanging(afterPosition, playedMove.to, mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}

	if (playedIsBest && beforePov < GREAT_NOT_ALREADY_DECIDED) {
		const secondPov = secondLineWinPercent(
			ply - 1,
			special.secondEvalPerPly,
			special.secondWdlPerPly
		);
		if (secondPov !== null) {
			const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
			if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
				return 'great';
			}
		}
	}

	if (beforePov >= MISS_WIN_BEFORE && afterPov < MISS_WIN_AFTER) {
		return 'miss';
	}

	return null;
}
