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

// KNOWN FAILURE -- investigated in depth, not a notation typo. See
// docs/references/calibration-log.md and .superpowers/sdd/task-4-report.md
// for the full writeup. Summary: findBookDepth(BYRNE_FISCHER_OPENING_SAN)
// against the real src/lib/data/openings.json trie returns 3, not >=12.
//
// Root cause is NOT a SAN disambiguation mismatch (every individual token
// above -- 'Nf3', 'Nc3', 'O-O', etc. -- exists verbatim in the dataset).
// It is a real move-order/transposition gap: this game's actual played
// order (1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4) reaches
// the same position as ECO D92 "Grunfeld Defense: Three Knights Variation,
// Hungarian Attack" (['d4','Nf6','c4','g6','Nc3','d5','Nf3','Bg7','Bf4']),
// confirmed by this repo's own reference PGN
// (docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn, tagged ECO
// "D92"). But `findBookDepth` walks a literal SAN-sequence trie
// (src/lib/game/book.ts, by design -- see book.test.ts) with no
// transposition normalization, so it cannot recognize the same theory
// reached via a different, equally legal move order.
//
// This isn't fixable by reordering the hardcoded SAN here: (a) doing so
// would misrepresent what Byrne/Fischer actually played move-by-move, and
// (b) it wouldn't even reach depth 12 anyway -- re-walking the trie in the
// dataset's own canonical (1.d4-first) order for this exact position tops
// out at depth 10 (['d4','Nf6','c4','g6','Nc3','d5','Nf3','Bg7','Bf4','O-O']);
// no catalogued line in this reduced ~3800-row lichess ECO dataset continues
// with 'Qb3' after 'O-O' in this branch (that continuation only exists as
// 'e3', per D93). So even the best-case transposition still falls short of
// chess.com's documented "Book 6/6" (12-ply) result for this game -- the
// gap is dataset coverage / trie design, not this test's move list.
//
// Left failing (not weakened, not force-passed) pending a decision from the
// plan owner: either extend book.ts with transposition-aware matching, swap
// in a deeper/position-keyed opening reference, or formally lower this
// game's ground truth for the current (ECO-summary-trie) implementation.
describe('Byrne vs. Fischer 1956 Book detection', () => {
	it("matches chess.com's real Book cutoff of at least 12 plies (6 moves per side)", () => {
		const depth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		expect(depth).toBeGreaterThanOrEqual(12);
	});

	it('classifies plies 1-12 as book without disturbing the existing Brilliant/Great fixture', () => {
		const bookPlyDepth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		const codes = classifyGame(fixture.evalPerPly, fixture.wdlPerPly, {
			positions: fixture.positions,
			moveMeta: fixture.moves,
			bestMoves: fixture.bestMoves,
			secondEvalPerPly: fixture.secondEvalPerPly,
			secondWdlPerPly: fixture.secondWdlPerPly,
			bookPlyDepth
		});

		for (let ply = 1; ply <= 12; ply++) {
			expect(codes[ply - 1]).toBe('book');
		}
		// The existing golden Brilliant/Great plies (indices 21, 29, 33, 37,
		// i.e. moves well past move 6) must survive Book's new top-priority check.
		expect(codes[21]).toBe('brilliant');
		expect(codes[37]).toBe('great');
	});
});
