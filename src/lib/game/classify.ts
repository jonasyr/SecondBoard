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
import { hasPositiveExchangeTarget, staticExchangeGain } from './attacks';

/** blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's
 * 0-100 win%-points scale (the blueprint's own numbers are on a 0-1 scale).
 * Brilliant's ceiling (80, not the deterministic table's own headroom) and
 * Great's gap (15) were both recalibrated against a complete golden-fixture
 * run of the Byrne-Fischer 1956 reference game (classify.reference-game.test.ts):
 * the original, higher thresholds fired on persistent-but-uncapitalized-on
 * sacrifices and continuations inside an already-overwhelming position. See
 * `sacrificeIsCausal` below for why a hanging piece alone is not sufficient
 * evidence that THIS move is what created the exposure.
 *
 * `BRILLIANT_CAUSAL_GAP` (25, up from 20) was further tuned against a second
 * reference game (Kasparov-Topalov 1999, see docs/references/calibration-log.md)
 * that exposed real false positives from the first pass -- see the
 * calibration log for the two documented, NOT-yet-solvable failure modes
 * this second pass left in place (Great's weak correlation with CP gap, and
 * a small number of Brilliant/Great false positives from generically
 * "strong" moves in a won position that this SEE-only heuristic cannot
 * distinguish from a genuine only-good-try sacrifice). */
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 80;
const BRILLIANT_MIN_SACRIFICE_VALUE = 3;
const BRILLIANT_CAUSAL_GAP = 25;
const GREAT_ONLY_MOVE_GAP = 15;
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

	const beforePosition = special.positions[ply - 1];
	const afterPosition = special.positions[ply];
	const opponent: 'w' | 'b' = mover === 'w' ? 'b' : 'w';

	// A position can contain a hanging piece that has nothing to do with the
	// move just played (e.g. it was already exposed several moves earlier and
	// simply never got captured). Requiring the moved piece's own SEE exposure
	// to have gotten worse (from == not attacked-for-more / to == attacked)
	// ties the sacrifice to THIS move -- exactly what distinguishes chess.com's
	// "Brilliant" from an ordinary continuation inside a won position. Best
	// moves with a large second-line CP gap (an "only good try") also qualify,
	// covering offered sacrifices whose value shows up in the engine gap
	// rather than in the moved piece's own exposure (17...Be6 in the reference
	// game: the bishop itself isn't what's hanging, the queen on b6 is).
	const secondWhitePov = secondLineWinPercent(
		ply - 1,
		special.secondEvalPerPly,
		special.secondWdlPerPly
	);
	const secondMoverPov = secondWhitePov === null ? null : mover === 'w' ? secondWhitePov : 100 - secondWhitePov;
	const cpGap = secondMoverPov === null ? null : beforeCpPov - secondMoverPov;

	const qualifyingAfterTarget = Boolean(
		afterPosition && hasPositiveExchangeTarget(afterPosition, mover, BRILLIANT_MIN_SACRIFICE_VALUE)
	);

	if (nearBest && qualifyingAfterTarget && afterCpPov >= BRILLIANT_MIN_WIN && beforeCpPov < BRILLIANT_NOT_WINNING) {
		const movedGainBefore =
			playedMove && beforePosition ? staticExchangeGain(beforePosition, playedMove.from, opponent) : 0;
		const movedGainAfter =
			playedMove && afterPosition ? staticExchangeGain(afterPosition, playedMove.to, opponent) : 0;
		// A one- or two-point SEE wobble (e.g. a pawn-level exchange detail) is
		// noise, not a genuine new sacrifice -- require at least a minor piece's
		// worth of newly-created exposure (calibrated against the Kasparov-Topalov
		// 1999 reference game: 22...Nbxd5 and 27.b4+ both showed a small positive
		// delta without being real sacrifices, see docs/references/calibration-log.md).
		const sacrificeIsCausal =
			movedGainAfter - movedGainBefore >= BRILLIANT_MIN_SACRIFICE_VALUE ||
			(playedIsBest && cpGap !== null && cpGap >= BRILLIANT_CAUSAL_GAP);

		if (sacrificeIsCausal) return 'brilliant';
	}

	// A move that leaves the mover's own material hanging isn't "the only good
	// move" in the sense chess.com means by Great -- that pattern is already
	// covered (or rejected) by the Brilliant check above.
	if (
		playedIsBest &&
		!qualifyingAfterTarget &&
		beforeCpPov < GREAT_NOT_ALREADY_DECIDED &&
		cpGap !== null &&
		cpGap >= GREAT_ONLY_MOVE_GAP
	) {
		return 'great';
	}

	if (beforeWdlPov >= MISS_WIN_BEFORE && afterWdlPov < MISS_WIN_AFTER) return 'miss';

	return null;
}
