/**
 * Real per-side game accuracy and winner, replacing the mocked
 * PLAYERS.white/black.accuracy fixture and hardcoded "0–1" result
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §12 "Accuracy
 * System"). This is a faithful port of lichess's open-source accuracy
 * algorithm (the closest publicly available approximation of chess.com-style
 * accuracy — chess.com's own algorithm is undisclosed, and independent
 * reverse-engineering efforts report it lines up with chess.com within a
 * couple of points): win%-sigmoid conversion, a per-move accuracy curve, and
 * a volatility-weighted-mean/harmonic-mean blend per side. Source ported:
 * https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala
 * and https://github.com/lichess-org/scalalib/blob/master/lila/src/main/scala/Maths.scala
 * (`standardDeviation`/`harmonicMean`/`weightedMean`). Still an approximation,
 * not a byte-for-byte match with chess.com's own undisclosed formula.
 */
import { sideToMoveForPly } from './notation';

/** lichess's `WinPercent.fromCentiPawns` sigmoid (accuracy.ts's own doc above
 * cites the source repo). `evalPawns` is White-POV, as produced by
 * engine-analysis.ts's evalPerPly. */
export function winPercentFromEval(evalPawns: number): number {
	const cp = evalPawns * 100;
	return 100 / (1 + Math.exp(-0.00368208 * cp));
}

/** Win/draw/loss per-mille (`w + d + l = 1000`), always stored White-POV in
 * this codebase — exactly like `evalPerPly` is White-POV pawns — so every
 * consumer applies the same mover-POV flip (`mover === 'w' ? x : 100 - x`)
 * uniformly regardless of whether a given ply's win% came from WDL or the
 * eval sigmoid. Raw engine WDL is side-to-move POV; engine-analysis.ts's
 * `toWhitePovWdl` is the one place that converts. */
export type Wdl = readonly [w: number, d: number, l: number];

/** Stockfish's own WDL model, converted to a White-POV win percentage
 * (blueprint §3.2: `ExpScore = (w + 0.5*d)/1000`, expressed here on the
 * 0-100 scale to match `winPercentFromEval`'s scale exactly). */
export function winPercentFromWdl(wdl: Wdl): number {
	return (wdl[0] + 0.5 * wdl[1]) / 10;
}

/** The one place that decides "WDL if the engine reported it for this ply,
 * else the eval sigmoid" -- both `computeGameAccuracy` and `classify.ts`'s
 * `classifyGame` call this instead of `winPercentFromEval` directly, so a
 * future ply-level data source only needs to be taught to this function
 * once. `wdlPerPly` is optional and index-aligned with `evalPerPly`; when
 * omitted, or when this ply's entry is missing/null, behavior is identical
 * to calling `winPercentFromEval` directly (byte-for-byte, existing
 * behavior is fully preserved for engine builds/positions without WDL). */
export function winPercentForPly(
	ply: number,
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): number {
	const wdl = wdlPerPly?.[ply];
	return wdl ? winPercentFromWdl(wdl) : winPercentFromEval(evalPerPly[ply]);
}

/** Population standard deviation (`Maths.standardDeviation` — lichess's own
 * comment: "using population variance", https://www.scribbr.com/statistics/standard-deviation/). */
function standardDeviation(xs: number[]): number {
	const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
	const variance = xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / xs.length;
	return Math.sqrt(variance);
}

/** `Maths.harmonicMean`: each value is floored at 1 before reciprocating, so
 * a single very-low-accuracy move can't blow the mean up towards infinity/0
 * in an unstable way. */
function harmonicMean(values: number[]): number | null {
	if (values.length === 0) return null;
	const denominator = values.reduce((sum, v) => sum + 1 / Math.max(1, v), 0);
	return values.length / denominator;
}

/** `Maths.weightedMean`: sum(value*weight)/sum(weight); undefined (null) if
 * there's nothing to average or the total weight is zero. */
function weightedMean(pairs: Array<[value: number, weight: number]>): number | null {
	if (pairs.length === 0) return null;
	let sumValueWeight = 0;
	let sumWeight = 0;
	for (const [value, weight] of pairs) {
		sumValueWeight += value * weight;
		sumWeight += weight;
	}
	return sumWeight === 0 ? null : sumValueWeight / sumWeight;
}

/** `AccuracyPercent.fromWinPercents`: a move that doesn't worsen the mover's
 * own win% at all scores exactly 100; otherwise an exponential decay curve
 * (lichess's exact fitted constants) plus a flat "+1 uncertainty bonus" for
 * imperfect analysis, clamped to [0, 100]. */
function moveAccuracyFromWinPercents(beforePov: number, afterPov: number): number {
	if (afterPov >= beforePov) return 100;
	const winDiff = beforePov - afterPov;
	const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) - 3.166924740191411;
	return Math.min(100, Math.max(0, raw + 1));
}

export interface GameAccuracy {
	white: number | null;
	black: number | null;
}

/**
 * Derives per-side game accuracy from the real Stockfish evalPerPly
 * (White-POV pawns, one entry per ply including the starting position) that
 * engine-analysis.ts's loadRealAnalysis() produces. Ports lichess's
 * `AccuracyPercent.gameAccuracy`: the game is split into overlapping windows
 * (size = ply-count/10, clamped [2, 8]; the first `windowSize - 2` moves
 * reuse the very first window so early moves aren't penalized for lacking
 * preceding context), each window's win% standard deviation becomes that
 * window's "volatility" weight (clamped [0.5, 12]), and each side's final
 * accuracy is the mean of that side's volatility-weighted mean and harmonic
 * mean of its own per-move accuracy scores. Returns null for a side (or
 * both) when there isn't enough data yet (e.g. analysis hasn't completed)
 * rather than a misleading number. `startPly` (default 0) shifts the
 * mover-color attribution for callers passing a SLICE of a larger game's
 * evalPerPly/wdlPerPly (e.g. one phase's ply range) rather than the whole
 * game from ply 0 -- see phase.ts's `getPhaseRows` for the motivating
 * caller.
 */
export function computeGameAccuracy(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	startPly = 0
): GameAccuracy {
	const plyCount = evalPerPly.length;
	if (plyCount < 2) return { white: null, black: null };

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const moveCount = plyCount - 1;
	const windowSize = Math.min(8, Math.max(2, Math.floor(moveCount / 10)));

	const windows: number[][] = [];
	const prefixWindowCount = Math.max(0, Math.min(windowSize, plyCount) - 2);
	for (let i = 0; i < prefixWindowCount; i++) windows.push(winPercents.slice(0, windowSize));
	for (let i = 0; i + windowSize <= plyCount; i++) windows.push(winPercents.slice(i, i + windowSize));
	const weights = windows.map((w) => Math.min(12, Math.max(0.5, standardDeviation(w))));

	const whitePairs: Array<[number, number]> = [];
	const blackPairs: Array<[number, number]> = [];
	const whiteAccuracies: number[] = [];
	const blackAccuracies: number[] = [];

	for (let ply = 0; ply < moveCount; ply++) {
		const mover = sideToMoveForPly(startPly + ply);
		const beforeWhitePov = winPercents[ply];
		const afterWhitePov = winPercents[ply + 1];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const accuracy = moveAccuracyFromWinPercents(beforePov, afterPov);
		const weight = weights[ply];
		if (mover === 'w') {
			whitePairs.push([accuracy, weight]);
			whiteAccuracies.push(accuracy);
		} else {
			blackPairs.push([accuracy, weight]);
			blackAccuracies.push(accuracy);
		}
	}

	const combine = (pairs: Array<[number, number]>, accuracies: number[]): number | null => {
		const weighted = weightedMean(pairs);
		const harmonic = harmonicMean(accuracies);
		return weighted === null || harmonic === null ? null : (weighted + harmonic) / 2;
	};

	return { white: combine(whitePairs, whiteAccuracies), black: combine(blackPairs, blackAccuracies) };
}

export type Winner = 'white' | 'black' | 'draw' | null;

/** Resolves the PGN `Result` tag (`'1-0'` / `'0-1'` / `'1/2-1/2'`) into a
 * winner. Any other value (missing tag, `'*'` = ongoing/unknown) is null. */
export function resolveWinner(result: string | null): Winner {
	if (result === '1-0') return 'white';
	if (result === '0-1') return 'black';
	if (result === '1/2-1/2') return 'draw';
	return null;
}

/**
 * Single-game "Game Rating" / "Est. performance": what rating a player who
 * played THIS game's moves would typically have, derived from the game's own
 * accuracy score — not from the win/loss result or either player's real
 * rating. This mirrors chess.com's own description of the metric ("Game
 * Rating" support article: "performance rating is determined by comparing
 * the quality of your moves to what is expected from a player at your
 * rating level"); chess.com does not publish the exact formula.
 *
 * Uses a community-derived linear fit against chess.com's own rapid-rating
 * accuracy data (blog: "Accuracy And Ratings On Chess.com" by hissha,
 * https://www.chess.com/blog/hissha/accuracy-and-ratings-on-chess-com):
 * `rating ≈ (accuracy - 64) * 100`. The author reports this tracking
 * chess.com rapid ratings closely for accuracy >= 80 (median error ~40 Elo);
 * it is a much rougher estimate below that, and chess.com's own docs note
 * single-game performance ratings are inherently volatile by design (one
 * strong game can produce a performance rating far above a player's real
 * rating). Clamped at a 100 floor so a very low accuracy doesn't produce a
 * nonsensical negative rating. Returns null when accuracy itself is null,
 * rather than fabricating a number.
 */
export function estimatePerformanceRating(accuracy: number | null): number | null {
	if (accuracy === null) return null;
	return Math.max(100, Math.round((accuracy - 64) * 100));
}
