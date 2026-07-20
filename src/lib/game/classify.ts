/**
 * Real per-move classification, replacing the fully-mocked CLASS_CODES
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §11) with
 * Chess.com's own published "Expected Points" cutoff table (Chess.com
 * support article, "How Are Moves Classified?"): a move's classification is
 * driven by how much win probability the mover lost by playing it, relative
 * to not losing any ground at all. Chess.com expresses this as
 * "expected points" on a 0-1 scale (Best 0.00 / Excellent <=0.02 / Good
 * <=0.05 / Inaccuracy <=0.10 / Mistake <=0.20 / Blunder >0.20); this module
 * uses win% on the 0-100 scale instead (identical up to a factor of 100),
 * since that's the scale `winPercentForPly` (accuracy.ts) already produces.
 * Ordinary loss bands and Miss use that WDL-preferred score track. Brilliant
 * and Great use a separate centipawn-derived track via `winPercentFromEval`,
 * so saturated WDL values do not distort their calibration; second-line Great
 * data likewise prefers centipawns and falls back to WDL only when absent.
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
import { winPercentForPly, winPercentFromEval } from './accuracy';
import { sideToMoveForPly } from './notation';
import { hasPositiveExchangeTarget } from './attacks';

/** blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's
 * 0-100 win%-points scale (the blueprint's own numbers are on a 0-1 scale). */
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const BRILLIANT_MIN_SACRIFICE_VALUE = 3;
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 99;
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
	const evalPawns = secondEvalPerPly?.[ply];
	if (evalPawns !== null && evalPawns !== undefined) return winPercentFromEval(evalPawns);
	const wdl = secondWdlPerPly?.[ply];
	return wdl ? (wdl[0] + 0.5 * wdl[1]) / 10 : null;
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

	const wdlScores = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const cpScores = evalPerPly.map(winPercentFromEval);
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWdlPov = mover === 'w' ? wdlScores[ply - 1] : 100 - wdlScores[ply - 1];
		const afterWdlPov = mover === 'w' ? wdlScores[ply] : 100 - wdlScores[ply];
		const beforeCpPov = mover === 'w' ? cpScores[ply - 1] : 100 - cpScores[ply - 1];
		const afterCpPov = mover === 'w' ? cpScores[ply] : 100 - cpScores[ply];
		const epLoss = beforeWdlPov - afterWdlPov;

		codes.push(
			classifySpecial(
				ply,
				mover,
				beforeWdlPov,
				afterWdlPov,
				beforeCpPov,
				afterCpPov,
				epLoss,
				special
			) ?? classifyMoveByEpLoss(epLoss)
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
	beforeWdlPov: number,
	afterWdlPov: number,
	beforeCpPov: number,
	afterCpPov: number,
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

	const afterPosition = special.positions[ply];

	if (
		nearBest &&
		afterPosition &&
		hasPositiveExchangeTarget(afterPosition, mover, BRILLIANT_MIN_SACRIFICE_VALUE) &&
		afterCpPov >= BRILLIANT_MIN_WIN &&
		beforeCpPov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}

	if (playedIsBest && beforeCpPov < GREAT_NOT_ALREADY_DECIDED) {
		const secondWhitePov = secondLineWinPercent(
			ply - 1,
			special.secondEvalPerPly,
			special.secondWdlPerPly
		);
		if (secondWhitePov !== null) {
			const secondMoverPov = mover === 'w' ? secondWhitePov : 100 - secondWhitePov;
			if (beforeCpPov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) return 'great';
		}
	}

	if (beforeWdlPov >= MISS_WIN_BEFORE && afterWdlPov < MISS_WIN_AFTER) return 'miss';

	return null;
}
