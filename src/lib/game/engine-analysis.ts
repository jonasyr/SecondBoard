/**
 * Orchestrates the Phase-0 engine spike: analyzes every ply of the mock Italian
 * Game with the real Stockfish-backed `analyze_fen` command and reshapes the
 * results into the same evalPerPly/bestMoves shape the (now-replaced) mock
 * EVAL_PER_PLY/BEST_MOVES arrays used. classCodes/coachText stay mocked — move
 * classification is out of scope for this iteration (LOGIC.md §7).
 */
import type { Move } from '$lib/board/types';
import { analyzeFen } from '$lib/api/engine';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
import { MOCK_POSITIONS } from './mock-data';

export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
}

/** Stockfish's score is relative to the side to move at the analyzed FEN — flip it
 * to White's POV (positive = good for White) so it matches evalBarPct's convention. */
function toWhitePovEval(evalCp: number, isMate: boolean, sideToMove: 'w' | 'b'): number {
	const moverPov = isMate ? 100 : evalCp / 100;
	return sideToMove === 'w' ? moverPov : -moverPov;
}

export async function loadRealAnalysis(): Promise<RealAnalysis> {
	const results = await Promise.all(
		MOCK_POSITIONS.map((position, ply) =>
			analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
		)
	);

	const evalPerPly = results.map((r, ply) =>
		toWhitePovEval(r.evalCp, r.isMate, sideToMoveForPly(ply))
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
	results.forEach((r, ply) => {
		if (ply === MOCK_POSITIONS.length - 1 || r.bestMoveUci.length < 4) return;
		const from = r.bestMoveUci.slice(0, 2);
		const to = r.bestMoveUci.slice(2, 4);
		bestMoves[ply + 1] = { from, to, san: moveToSan(MOCK_POSITIONS[ply], { from, to }) };
	});

	return { evalPerPly, bestMoves };
}
