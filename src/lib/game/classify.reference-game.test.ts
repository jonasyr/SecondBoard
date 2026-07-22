import { describe, expect, it } from 'vitest';
import { classifyGame } from './classify';
import { findBookDepth } from './book';
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

// The exact opening SAN played in Donald Byrne vs. Bobby Fischer, 1956
// ("The Game of the Century") -- public historical record, not derived from
// the fixture JSON above (which stores Move{from,to} pairs, not SAN).
// Chess.com's own Game Review marks this game's first 6 moves per side (12
// plies) as Book -- see docs/references/calibration-log.md, "Book 6 / 6".
const BYRNE_FISCHER_OPENING_SAN = [
	'Nf3',
	'Nf6',
	'c4',
	'g6',
	'Nc3',
	'Bg7',
	'd4',
	'O-O',
	'Bf4',
	'd5',
	'Qb3',
	'dxc4'
];

// CONFIRMED, STABLE GAP -- not a bug in book.ts and not a notation typo. See
// docs/references/calibration-log.md ("Book 6/6") and
// .superpowers/sdd/task-4-report.md for the full investigation.
//
// This game's actual played move order (1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O
// 5.Bf4 d5 6.Qb3 dxc4), confirmed against this repo's own reference PGN
// (docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn, tagged ECO
// "D92"), transposes into the dataset's own D92 row via a different literal
// move order. `findBookDepth` (src/lib/game/book.ts) walks a literal
// SAN-sequence trie by design (see book.test.ts) with no transposition
// normalization, so it stops at the first divergence: depth 3
// (['Nf3','Nf6','c4'], diverging at 'g6').
//
// Reordering the hardcoded SAN here would not help either: re-walking the
// trie in the dataset's own canonical (1.d4-first) order for this exact
// position only reaches depth 10
// (['d4','Nf6','c4','g6','Nc3','d5','Nf3','Bg7','Bf4','O-O']) -- no
// catalogued line in this reduced ~3800-row lichess ECO dataset continues
// with 'Qb3' after 'O-O' in this branch (that continuation only exists as
// 'e3', per D93). So even the best-case transposition still falls short of
// chess.com's documented "Book 6/6" (12-ply) result for this game.
//
// This test asserts the real, verified depth (3) rather than the aspirational
// chess.com-parity number. The gap is dataset coverage / move-order-unaware
// trie design, out of scope for this iteration -- a future iteration could
// close it by extending book.ts with transposition-aware matching or by
// swapping in a deeper/position-keyed opening reference.
describe('Byrne vs. Fischer 1956 Book detection', () => {
	it('recognizes only the first 3 plies as book, short of chess.com\'s 12-ply result, due to the transposition gap', () => {
		const depth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		expect(depth).toBe(3);
	});

	it('classifies plies 1-3 as book without disturbing the existing Brilliant/Great fixture', () => {
		const bookPlyDepth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		const codes = classifyGame(fixture.evalPerPly, fixture.wdlPerPly, {
			positions: fixture.positions,
			moveMeta: fixture.moves,
			bestMoves: fixture.bestMoves,
			secondEvalPerPly: fixture.secondEvalPerPly,
			secondWdlPerPly: fixture.secondWdlPerPly,
			bookPlyDepth
		});

		for (let ply = 1; ply <= 3; ply++) {
			expect(codes[ply - 1]).toBe('book');
		}
		// The existing golden Brilliant/Great plies (indices 21, 29, 33, 37,
		// i.e. moves well past move 6) must survive Book's new top-priority check.
		expect(codes[21]).toBe('brilliant');
		expect(codes[37]).toBe('great');
	});
});
