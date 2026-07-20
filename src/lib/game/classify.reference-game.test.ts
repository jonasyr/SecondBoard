import { describe, expect, it } from 'vitest';
import { classifyGame } from './classify';
import fixtureJson from './fixtures/byrne-fischer-analysis.json';
import { staticExchangeGain } from './attacks';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';

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

describe('Byrne vs. Fischer 1956 golden analysis', () => {
	it.each([
		[21, '11...Na4'],
		[29, '15...Nxc3'],
		[33, '17...Be6']
	])('classifies move index %i (%s) as Brilliant', (moveIndex) => {
		expect(classifyReferenceGame()[moveIndex]).toBe('brilliant');
	});

	it('detects Be6 through the exposed queen rather than the moved bishop', () => {
		const afterBe6 = fixture.positions[34];
		expect(staticExchangeGain(afterBe6, 'e6', 'w')).toBe(0);
		expect(staticExchangeGain(afterBe6, 'b6', 'w')).toBeGreaterThan(0);
	});

	it('classifies 19...Ne2+ as Great', () => {
		expect(classifyReferenceGame()[37]).toBe('great');
	});

	it('has exact Fischer counts and no extra special labels for either player', () => {
		const codes = classifyReferenceGame();
		const indices = (code: 'brilliant' | 'great') =>
			codes.flatMap((candidate, index) => (candidate === code ? [index] : []));

		expect(indices('brilliant')).toEqual([21, 29, 33]);
		expect(indices('great')).toEqual([37]);
		expect(indices('brilliant').filter((index) => index % 2 === 0)).toEqual([]);
		expect(indices('great').filter((index) => index % 2 === 0)).toEqual([]);
	});
});
