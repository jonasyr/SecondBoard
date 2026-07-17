/**
 * Real per-side game accuracy and winner, replacing the mocked
 * PLAYERS.white/black.accuracy fixture and hardcoded "0–1" result
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §12 "Accuracy
 * System"). This is the standard public win%-sigmoid approximation used by
 * lichess/chess.com-style accuracy estimators, NOT chess.com's undisclosed
 * exact algorithm (which additionally volatility-weights the average rather
 * than taking a simple mean) — treat the output as a close estimate, not a
 * byte-for-byte match.
 */
import type { PieceColor } from '$lib/board/types';
import { sideToMoveForPly } from './notation';

/** OVERVIEW §11.5's expected_score sigmoid, tuned with the constant commonly
 * used by public lichess/chess.com accuracy-estimate implementations.
 * `evalPawns` is White-POV, as produced by engine-analysis.ts's evalPerPly. */
export function winPercentFromEval(evalPawns: number): number {
	const cp = evalPawns * 100;
	return 100 / (1 + Math.exp(-0.00368208 * cp));
}

/** Converts one move's win%-loss (from the mover's own POV) into a 0-100
 * per-move accuracy score. A move that doesn't worsen the mover's win% at
 * all (loss <= 0) scores ~100; accuracy decays smoothly as the loss grows. */
function moveAccuracy(winPercentLoss: number): number {
	const loss = Math.max(0, winPercentLoss);
	const acc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
	return Math.min(100, Math.max(0, acc));
}

export interface GameAccuracy {
	white: number | null;
	black: number | null;
}

/**
 * Derives per-side game accuracy from the real Stockfish evalPerPly
 * (White-POV pawns, one entry per ply including the starting position) that
 * engine-analysis.ts's loadRealAnalysis() produces. Each ply transition's
 * mover is scored by how much their own win% dropped from before their move
 * to after it; a side's game accuracy is the mean of its own moves' scores.
 * Returns null for a side (or both) when there isn't enough data yet (e.g.
 * analysis hasn't completed) rather than a misleading number.
 */
export function computeGameAccuracy(evalPerPly: number[]): GameAccuracy {
	if (evalPerPly.length < 2) return { white: null, black: null };

	const whiteScores: number[] = [];
	const blackScores: number[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover: PieceColor = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercentFromEval(evalPerPly[ply - 1]);
		const afterWhitePov = winPercentFromEval(evalPerPly[ply]);
		const moverBefore = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const moverAfter = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const score = moveAccuracy(moverBefore - moverAfter);
		(mover === 'w' ? whiteScores : blackScores).push(score);
	}

	const mean = (xs: number[]): number | null =>
		xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null;

	return { white: mean(whiteScores), black: mean(blackScores) };
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
