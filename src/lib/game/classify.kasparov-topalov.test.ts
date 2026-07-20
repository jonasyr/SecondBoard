import { describe, expect, it } from 'vitest';
import { classifyGame } from './classify';
import fixtureJson from './fixtures/kasparov-topalov-analysis.json';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';

/**
 * Second reference game (Kasparov vs. Topalov, Wijk aan Zee 1999), used
 * specifically to check the Byrne-Fischer calibration (classify.reference-game.test.ts)
 * for overfitting to a single game. It was: full comparison and remaining
 * known gaps are tracked in docs/references/calibration-log.md, not repeated
 * here. Unlike the Fischer fixture, this file does NOT assert exact parity
 * with chess.com's full Brilliant/Great set -- our SEE-only, MultiPV=2
 * heuristic cannot yet reproduce several of chess.com's calls (see the log),
 * and per this plan's Global Constraints, closing that gap with game-specific
 * production logic is explicitly disallowed. This file locks in what DOES
 * generalize: the true positives shared with Game 1's calibration, and a
 * regression guard for the two false positives (22...Nbxd5, 27.b4+) that this
 * session's fix (`BRILLIANT_MIN_SACRIFICE_VALUE`-gated causal delta) removed.
 */

interface ReferenceAnalysisFixture {
	positions: Position[];
	moves: Move[];
	evalPerPly: number[];
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
	bestMoves: Record<number, Move & { san: string }>;
}

const fixture = fixtureJson as unknown as ReferenceAnalysisFixture;

function classifyReferenceGame() {
	return classifyGame(fixture.evalPerPly, fixture.wdlPerPly, {
		positions: fixture.positions,
		moveMeta: fixture.moves,
		bestMoves: fixture.bestMoves,
		secondEvalPerPly: fixture.secondEvalPerPly,
		secondWdlPerPly: fixture.secondWdlPerPly
	});
}

describe('Kasparov vs. Topalov 1999 golden analysis', () => {
	it.each([
		[45, 'brilliant/great mix check: 23...Qd6', 'great'],
		[48, '25.Re7+', 'brilliant'],
		[49, '25...Kb6', 'great'],
		[58, '30.Rxb7', 'brilliant'],
		[66, '34.Qa1+', 'great'],
		[68, '35.Qb2+', 'great'],
		[70, '36.Bf1', 'brilliant'],
		[72, '37.Rd7', 'brilliant']
	])('classifies move index %i (%s) as chess.com does: %s', (moveIndex, _label, expected) => {
		expect(classifyReferenceGame()[moveIndex]).toBe(expected);
	});

	it('no longer misclassifies 22...Nbxd5 or 27.b4+ as brilliant (small SEE-delta false positives, fixed this session)', () => {
		const codes = classifyReferenceGame();
		expect(codes[43]).not.toBe('brilliant'); // 22...Nbxd5 -- SEE delta was only 2
		expect(codes[52]).not.toBe('brilliant'); // 27.b4+ -- SEE delta was only 1; chess.com calls this Great
	});
});
