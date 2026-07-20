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
 * since that's the scale `winPercentFromEval` (accuracy.ts, itself an exact
 * port of lichess's sigmoid) already produces — reusing it keeps the eval
 * math consistent between accuracy and classification instead of
 * introducing a second, slightly different win-probability model.
 *
 * Scope note: this is the deterministic "core" classifier only (the 6
 * cutoff-table classes). Book/Brilliant/Great/Miss/Forced are Chess.com's
 * fuzzier, rating-scaled special cases (piece-sacrifice detection,
 * only-move detection, opening-book lookup) and are intentionally a later
 * iteration — see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
 */
import type { ClassCode } from '$lib/types';
import { winPercentFromEval } from './accuracy';
import { sideToMoveForPly } from './notation';

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
export function classifyGame(evalPerPly: number[]): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map(winPercentFromEval);
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		codes.push(classifyMoveByEpLoss(beforePov - afterPov));
	}

	return codes;
}
