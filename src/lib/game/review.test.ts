import { describe, it, expect } from 'vitest';
import { getReviewPly, getPlayerRows, type GameData } from './review';

// moveMeta has 31 entries (index i = the move that produced ply i+1). Only
// plies 1, 2, and 31 are ever asserted on below, so every other entry is an
// inert placeholder — real values only where a test actually checks them.
const sampleMoveMeta = Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }));
sampleMoveMeta[0] = { from: 'e2', to: 'e4' }; // ply 1
sampleMoveMeta[1] = { from: 'e7', to: 'e5' }; // ply 2
sampleMoveMeta[30] = { from: 'f6', to: 'e5' }; // ply 31

const sampleGame: GameData = {
	sanList: [
		'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6',
		'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1', 'Qe7', 'Ng3', 'Rad8', 'd4',
		'exd4', 'cxd4', 'd5', 'Ne5'
	],
	positions: Array.from({ length: 32 }, () => ({})), // content unused by these tests
	moveMeta: sampleMoveMeta,
	isSample: true,
	whiteName: null,
	blackName: null,
	whiteRating: null,
	blackRating: null
};

const notSampleGame: GameData = {
	sanList: ['d4', 'd5'],
	positions: [{}, {}, {}],
	moveMeta: [
		{ from: 'd2', to: 'd4' },
		{ from: 'd7', to: 'd5' }
	],
	isSample: false,
	whiteName: null,
	blackName: null,
	whiteRating: null,
	blackRating: null
};

describe('getReviewPly', () => {
	it('ply 0 has no lastMove/classCode and the intro coach text', () => {
		const r = getReviewPly(0, sampleGame);
		expect(r.lastMove).toBeNull();
		expect(r.classCode).toBeNull();
		expect(r.coachMove).toBe('Start');
		expect(r.coachText).toBe(
			'The game begins. Step through with the arrows or arrow keys to see every move classified.'
		);
		expect(r.evalStr).toBe('+0.00');
	});

	it('ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"', () => {
		const r = getReviewPly(1, sampleGame);
		expect(r.classCode).toBe('book');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('a black ply renders "N... san" with the ellipsis separator', () => {
		const r = getReviewPly(2, sampleGame); // 1...e5
		expect(r.coachMove).toBe('1... e5');
	});

	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14, sampleGame).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy
		expect(getReviewPly(1, sampleGame).best).toBeNull(); // book, not a NOT_BEST code
	});

	it('computes whitePct via evalBarPct semantics (50 + clamp(ev/8*44))', () => {
		const r = getReviewPly(31, sampleGame); // eval 2.37
		expect(r.whitePct).toBeCloseTo(50 + Math.min(44, (2.37 / 8) * 44), 5);
	});

	it('accepts explicit evalPerPly/bestMoves overrides instead of the static mock arrays', () => {
		const r = getReviewPly(1, sampleGame, [0, 99], {});
		expect(r.evalNum).toBe(99);
		expect(r.evalStr).toBe('+99.00');
	});

	it('does not apply classification/coach text to a non-sample game', () => {
		const r = getReviewPly(1, notSampleGame);
		expect(r.classCode).toBeNull();
		expect(r.best).toBeNull();
		expect(r.coachText).toBe(
			"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview."
		);
		expect(r.coachMove).toBe('1. d4'); // sanList is still real regardless of isSample
	});

	it('exposes `nextBest` as bestMoves[ply + 1], regardless of classCode/isSample', () => {
		expect(getReviewPly(13, sampleGame).nextBest).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // BEST_MOVES[14]
		expect(getReviewPly(29, sampleGame).nextBest).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' }); // BEST_MOVES[30]

		// Independent of classCode/isSample: same lookup on a non-sample game
		// with an explicit bestMoves override, at a ply that isn't a NOT_BEST
		// classification (so `best` would be null while `nextBest` is not).
		const r = getReviewPly(0, notSampleGame, [0, 0, 0], {
			1: { from: 'd2', to: 'd4', san: 'd4' }
		});
		expect(r.best).toBeNull();
		expect(r.nextBest).toEqual({ from: 'd2', to: 'd4', san: 'd4' });
	});

	it('`nextBest` is null at the final ply (no next move to suggest) and when bestMoves has no entry', () => {
		expect(getReviewPly(31, sampleGame).nextBest).toBeNull(); // final ply, bestMoves[32] never exists
		expect(getReviewPly(5, sampleGame, undefined, {}).nextBest).toBeNull(); // empty bestMoves override
	});
});

describe('getPlayerRows', () => {
	it('unflipped: Black on top, White on bottom (whiteAtBottom)', () => {
		const { top, bottom } = getPlayerRows(31, false, sampleGame);
		expect(top.name).toBe('DominikP');
		expect(bottom.name).toBe('Jonas');
	});

	it('flipped: White on top, Black on bottom', () => {
		const { top, bottom } = getPlayerRows(31, true, sampleGame);
		expect(top.name).toBe('Jonas');
		expect(bottom.name).toBe('DominikP');
	});

	it('highlights the clock of the side to move (odd ply = Black to move)', () => {
		const { top, bottom } = getPlayerRows(1, false, sampleGame); // ply 1 -> Black to move next
		expect(top.name).toBe('DominikP');
		expect(top.clockActive).toBe(true);
		expect(bottom.clockActive).toBe(false);
	});

	it('uses real PGN White/Black/*Elo tags over the mock PLAYERS fallback when present', () => {
		const realGame: GameData = {
			...notSampleGame,
			whiteName: 'Donald Byrne',
			blackName: 'Robert James Fischer',
			whiteRating: '1800',
			blackRating: null
		};
		const { top, bottom } = getPlayerRows(0, false, realGame);
		expect(bottom.name).toBe('Donald Byrne');
		expect(bottom.rating).toBe('1800');
		expect(bottom.initial).toBe('D');
		expect(top.name).toBe('Robert James Fischer');
		expect(top.initial).toBe('R');
		// blackRating is null (no BlackElo tag) -> falls back to the mock rating.
		expect(top.rating).not.toBe('');
	});
});
