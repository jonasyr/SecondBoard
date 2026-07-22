// scripts/calibration/calibrate.ts
// Usage: pnpm exec vite-node scripts/calibration/calibrate.ts
import { readdirSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classifyGame } from '../../src/lib/game/classify';
import { findBookDepth } from '../../src/lib/game/book';
import {
	diffClassifications,
	aggregateDiffResults,
	mapChesscomLabel,
	type DiffResult
} from '../../src/lib/calibration/diff-engine';
import { analyzeFen } from './stockfish-client';
import type { CalibrationFixture } from '../../src/lib/calibration/types';
import type { Position, Move } from '../../src/lib/board/types';

export interface FixtureInputs {
	positions: Position[];
	moveMeta: Move[];
	legalMoveCounts: number[];
	evalPerPly: number[];
	wdlPerPly: ([number, number, number] | null)[];
	bookPlyDepth: number;
}

function boardToPosition(chess: InstanceType<typeof Chess>): Position {
	const position: Position = {};
	for (const row of chess.board()) {
		for (const cell of row) {
			if (!cell) continue;
			position[cell.square] = [cell.type.toUpperCase() as Position[string][0], cell.color];
		}
	}
	return position;
}

/** The expensive, config-independent half of analyzing a fixture: parses its
 * PGN with chess.js and spawns Stockfish once per ply. Callers that only
 * need to try different classifier constants (Task 11's sweep) should
 * compute this ONCE per fixture and reuse it across every candidate config,
 * since none of it depends on classify.ts's tunable thresholds. */
export async function computeFixtureInputs(fixture: CalibrationFixture): Promise<FixtureInputs> {
	const parsed = new Chess();
	parsed.loadPgn(fixture.pgn);
	const sanHistory = parsed.history();

	const replay = new Chess();
	const positions: Position[] = [boardToPosition(replay)];
	const moveMeta: Move[] = [];
	const legalMoveCounts: number[] = [];
	const evalPerPly: number[] = [0];
	const wdlPerPly: ([number, number, number] | null)[] = [null];

	for (const san of sanHistory) {
		legalMoveCounts.push(replay.moves().length);
		const move = replay.move(san);
		moveMeta.push({ from: move.from, to: move.to });
		positions.push(boardToPosition(replay));

		const sideToMove = replay.turn(); // 'w' | 'b' -- who moves next from here
		const evalResult = await analyzeFen(replay.fen());
		// mate scores are approximated as a large centipawn value for this
		// offline tool only -- the shipped app's own mate handling
		// (src-tauri/src/lib.rs's AnalyzeFenResult.isMate) is unaffected.
		const cp = evalResult.mate !== null ? Math.sign(evalResult.mate) * 10000 : (evalResult.cp ?? 0);
		evalPerPly.push(sideToMove === 'w' ? cp / 100 : -(cp / 100));
		wdlPerPly.push(
			evalResult.wdl
				? sideToMove === 'w'
					? evalResult.wdl
					: [evalResult.wdl[2], evalResult.wdl[1], evalResult.wdl[0]]
				: null
		);
	}

	return {
		positions,
		moveMeta,
		legalMoveCounts,
		evalPerPly,
		wdlPerPly,
		bookPlyDepth: findBookDepth(sanHistory)
	};
}

/** The cheap, config-dependent half: classifies our own game and diffs it
 * against the fixture's chess.com ground truth. Pure given `inputs`. */
export function classifyAndDiff(fixture: CalibrationFixture, inputs: FixtureInputs): DiffResult {
	const ourCodes = classifyGame(inputs.evalPerPly, inputs.wdlPerPly, {
		positions: inputs.positions,
		moveMeta: inputs.moveMeta,
		bestMoves: {},
		bookPlyDepth: inputs.bookPlyDepth,
		legalMoveCounts: inputs.legalMoveCounts
	});

	const chesscomCodes = fixture.positions.slice(1).map((p) => mapChesscomLabel(p.classificationName));
	const moveLans = fixture.positions.slice(1).map((p) => p.playedMoveLan);

	return diffClassifications(fixture.gameId, ourCodes, chesscomCodes, moveLans);
}

async function main() {
	const dir = 'docs/references/calibration-games';
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
	const results: DiffResult[] = [];

	for (const file of files) {
		const fixture = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8')) as CalibrationFixture;
		console.log(`Analyzing ${file}...`);
		const inputs = await computeFixtureInputs(fixture);
		results.push(classifyAndDiff(fixture, inputs));
	}

	const aggregate = aggregateDiffResults(results);
	console.log(`\nExact match rate: ${(aggregate.exactMatchRate * 100).toFixed(1)}%`);
	console.log('Confusion matrix (rows = ours, columns = chess.com):');
	console.log(JSON.stringify(aggregate.confusionMatrix, null, 2));
	console.log(`\n${aggregate.mismatches.length} mismatched plies:`);
	for (const m of aggregate.mismatches) {
		console.log(`  ${m.gameSlug} ply ${m.ply} (${m.moveLan}): ours=${m.ours} chess.com=${m.chesscom}`);
	}
}

main();
