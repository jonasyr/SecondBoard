/**
 * Orchestrates the Phase-0 engine spike: analyzes every ply of the currently
 * loaded real game (its `positions`, from `GameData`) with the real
 * Stockfish-backed `analyze_fen` command and reshapes the results into the
 * same evalPerPly/bestMoves shape the (now-replaced) mock EVAL_PER_PLY/
 * BEST_MOVES arrays used. classCodes/coachText stay mocked — move
 * classification is out of scope for this iteration (LOGIC.md §7).
 */
import type { Move, Position, PieceColor } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { analyzeFen } from '$lib/api/engine';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';

export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
}

/** Number of `analyzeFen` calls (and thus real Stockfish processes) allowed to be
 * in flight simultaneously. Each call spawns a separate engine process configured
 * with a 256MB hash table, so an unbounded fan-out over the loaded game's positions
 * risks OOM/thrashing on modest hardware. 4 keeps peak usage to ~1GB of hash. */
const ANALYSIS_CONCURRENCY = 4;

/** Maps `items` through `fn`, running at most `limit` calls concurrently. Results
 * preserve input order: `results[i]` always corresponds to `items[i]`, regardless
 * of batch boundaries or resolution order within a batch. */
async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	for (let start = 0; start < items.length; start += limit) {
		const batch = items.slice(start, start + limit);
		const batchResults = await Promise.all(
			batch.map((item, offset) => fn(item, start + offset))
		);
		batchResults.forEach((result, offset) => {
			results[start + offset] = result;
		});
	}
	return results;
}

/** Stockfish's score is relative to the side to move at the analyzed FEN — flip it
 * to White's POV (positive = good for White) so it matches evalBarPct's convention. */
function toWhitePovEval(evalCp: number, sideToMove: 'w' | 'b'): number {
	return sideToMove === 'w' ? evalCp / 100 : -(evalCp / 100);
}

/** Stockfish's WDL is relative to the side to move at the analyzed FEN, exactly
 * like its cp score -- flip win/loss (draw is symmetric) to White's POV so it
 * matches `evalPerPly`'s convention and can be indexed identically. */
function toWhitePovWdl(wdl: [number, number, number], sideToMove: PieceColor): Wdl {
	return sideToMove === 'w' ? wdl : [wdl[2], wdl[1], wdl[0]];
}

export async function loadRealAnalysis(positions: Position[]): Promise<RealAnalysis> {
	const results = await mapWithConcurrency(positions, ANALYSIS_CONCURRENCY, (position, ply) =>
		analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
	);

	const evalPerPly = results.map((r, ply) =>
		toWhitePovEval(r.evalCp, sideToMoveForPly(ply))
	);

	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const secondEvalPerPly = results.map((r, ply) =>
		r.secondEvalCp === null ? null : toWhitePovEval(r.secondEvalCp, sideToMoveForPly(ply))
	);

	const secondWdlPerPly = results.map((r, ply) =>
		r.secondWdl ? toWhitePovWdl(r.secondWdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
	results.forEach((r, ply) => {
		if (ply === positions.length - 1 || r.bestMoveUci.length < 4) return;
		const from = r.bestMoveUci.slice(0, 2);
		const to = r.bestMoveUci.slice(2, 4);
		bestMoves[ply + 1] = { from, to, san: moveToSan(positions[ply], { from, to }) };
	});

	return { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly };
}
