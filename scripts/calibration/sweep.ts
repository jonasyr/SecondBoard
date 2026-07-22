// scripts/calibration/sweep.ts
// Usage: pnpm exec vite-node scripts/calibration/sweep.ts
// Sweeps a small grid over the two constants this codebase's own header
// comments (classify.ts) flag as hand-tuned against only 2 reference games
// (brilliantCausalGap, greatOnlyMoveGap), re-running classification (cheap)
// against every captured fixture's PRE-COMPUTED engine inputs (expensive,
// computed once per fixture, not once per grid point) and reporting the
// combination with the best aggregate exact-match rate.
import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_CLASSIFIER_CONFIG, classifyGame, type ClassifierConfig } from '../../src/lib/game/classify';
import { diffClassifications, aggregateDiffResults, mapChesscomLabel } from '../../src/lib/calibration/diff-engine';
import { computeFixtureInputs, type FixtureInputs } from './calibrate';
import type { CalibrationFixture } from '../../src/lib/calibration/types';

const BRILLIANT_CAUSAL_GAP_CANDIDATES = [15, 20, 25, 30];
const GREAT_ONLY_MOVE_GAP_CANDIDATES = [10, 15, 20];

function diffWithConfig(fixture: CalibrationFixture, inputs: FixtureInputs, config: ClassifierConfig) {
	const ourCodes = classifyGame(
		inputs.evalPerPly,
		inputs.wdlPerPly,
		{
			positions: inputs.positions,
			moveMeta: inputs.moveMeta,
			bestMoves: {},
			bookPlyDepth: inputs.bookPlyDepth,
			legalMoveCounts: inputs.legalMoveCounts
		},
		config
	);
	const chesscomCodes = fixture.positions.slice(1).map((p) => mapChesscomLabel(p.classificationName));
	const moveLans = fixture.positions.slice(1).map((p) => p.playedMoveLan);
	return diffClassifications(fixture.gameId, ourCodes, chesscomCodes, moveLans);
}

async function main() {
	const dir = 'docs/references/calibration-games';
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	const fixturesWithInputs: Array<{ fixture: CalibrationFixture; inputs: FixtureInputs }> = [];
	for (const file of files) {
		const fixture = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8')) as CalibrationFixture;
		console.log(`Computing engine inputs for ${file}...`);
		fixturesWithInputs.push({ fixture, inputs: await computeFixtureInputs(fixture) });
	}

	let best: { config: ClassifierConfig; exactMatchRate: number } | null = null;

	for (const brilliantCausalGap of BRILLIANT_CAUSAL_GAP_CANDIDATES) {
		for (const greatOnlyMoveGap of GREAT_ONLY_MOVE_GAP_CANDIDATES) {
			const config: ClassifierConfig = {
				...DEFAULT_CLASSIFIER_CONFIG,
				brilliantCausalGap,
				greatOnlyMoveGap
			};
			const results = fixturesWithInputs.map(({ fixture, inputs }) => diffWithConfig(fixture, inputs, config));
			const aggregate = aggregateDiffResults(results);
			console.log(
				`brilliantCausalGap=${brilliantCausalGap} greatOnlyMoveGap=${greatOnlyMoveGap} -> ${(aggregate.exactMatchRate * 100).toFixed(1)}%`
			);
			if (!best || aggregate.exactMatchRate > best.exactMatchRate) {
				best = { config, exactMatchRate: aggregate.exactMatchRate };
			}
		}
	}

	console.log('\nBest combination (a recommendation only -- a human reviews this before adopting it):');
	console.log(JSON.stringify(best, null, 2));
}

main();
