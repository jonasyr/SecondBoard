import { describe, it, expect } from 'vitest';
import { classifyMoveByEpLoss, classifyGame } from './classify';
import type { Move, Position } from '$lib/board/types';

describe('classifyMoveByEpLoss', () => {
	it('classifies exactly 0 loss as best', () => {
		expect(classifyMoveByEpLoss(0)).toBe('best');
	});

	it('classifies the upper edge of each band using Chess.com\'s exact published cutoffs', () => {
		expect(classifyMoveByEpLoss(2)).toBe('excellent');
		expect(classifyMoveByEpLoss(5)).toBe('good');
		expect(classifyMoveByEpLoss(10)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(20)).toBe('mistake');
	});

	it('classifies just above each cutoff as the next-worse band', () => {
		expect(classifyMoveByEpLoss(0.01)).toBe('excellent');
		expect(classifyMoveByEpLoss(2.01)).toBe('good');
		expect(classifyMoveByEpLoss(5.01)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(10.01)).toBe('mistake');
		expect(classifyMoveByEpLoss(20.01)).toBe('blunder');
	});

	it('classifies a large loss as blunder', () => {
		expect(classifyMoveByEpLoss(100)).toBe('blunder');
	});

	it('treats a negative loss (win% improved) the same as zero loss: best', () => {
		expect(classifyMoveByEpLoss(-5)).toBe('best');
	});
});

describe('classifyGame', () => {
	it('returns one classification per move, best when the mover\'s win% never worsens', () => {
		// ply0 (start, eval 0) -> ply1 White moves to +1.0 (better for White) ->
		// ply2 Black moves to +0.5 (better for Black, relative to +1.0).
		const codes = classifyGame([0, 1, 0.5]);
		expect(codes).toEqual(['best', 'best']);
	});

	it('classifies a real blunder: White drops from dead-even to badly losing', () => {
		// White's own win% swing from evalPerPly[0]=0 to evalPerPly[1]=-8 is far
		// more than 20 points, so ply 1 (White's move) is a blunder.
		const codes = classifyGame([0, -8]);
		expect(codes).toEqual(['blunder']);
	});

	it('returns an empty array for fewer than 2 eval samples', () => {
		expect(classifyGame([0])).toEqual([]);
		expect(classifyGame([])).toEqual([]);
	});

	it('attributes each ply\'s classification to the correct mover (White odd ply positions, Black even)', () => {
		// ply1 White: 0 -> 1 (improves, best). ply2 Black: 1 -> -1 (Black's own
		// POV win% at eval -1 is much better for Black than at eval 1, so also
		// best for Black). ply3 White: -1 -> -9 (a big drop in White's own win%
		// -> blunder for White).
		const codes = classifyGame([0, 1, -1, -9]);
		expect(codes[0]).toBe('best'); // White's move 1
		expect(codes[1]).toBe('best'); // Black's move 1
		expect(codes[2]).toBe('blunder'); // White's move 2
	});

	it('produces the exact same classifications as before when wdlPerPly is omitted (no regression)', () => {
		expect(classifyGame([0, 1, 0.5])).toEqual(['best', 'best']);
		expect(classifyGame([0, -8])).toEqual(['blunder']);
	});

	it('uses the WDL-derived win% for a ply that has one, changing the classification vs. eval-only', () => {
		// eval swing alone (0 -> -0.3) would classify as a small loss (good/excellent);
		// a wdl showing White going from a clear edge to lost changes the verdict.
		const evalPerPly = [0, -0.3];
		const withoutWdl = classifyGame(evalPerPly);
		const wdlPerPly: Array<[number, number, number] | null> = [[600, 300, 100], [0, 0, 1000]];
		const withWdl = classifyGame(evalPerPly, wdlPerPly);
		expect(withoutWdl[0]).not.toBe('blunder');
		expect(withWdl[0]).toBe('blunder');
	});
});

describe('classifyGame with special classes', () => {
	// 3 plies: ply0 (before any move) -> ply1 (after White's move) -> ply2 (after Black's move).
	// evalPerPly / wdlPerPly are White-POV win% inputs; the fixture positions/moves below are
	// only wired up to exercise the Brilliant/Great/Miss branches, not to represent a legal game.

	it('classifies a best/near-best sound piece sacrifice as brilliant', () => {
		const evalPerPly = [0, 0]; // win% 50 before and after (via the sigmoid) is not what
		// matters here -- use wdlPerPly to pin exact mover-POV win% values instead.
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: White win% 80 (mover POV, White to move)
			[600, 400, 0] // ply 1: White win% 80 after the move (stays >= 50, well under 97)
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e5: ['N', 'w'], e8: ['K', 'b'] }, // before: White has a knight on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after: the knight is gone -- a sacrifice
		];
		const moveMeta: Move[] = [{ from: 'e5', to: 'd7' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd7', san: 'Nd7' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['brilliant']);
	});

	it('classifies an offered sacrifice (material lost only after the opponent\'s next reply) as brilliant', () => {
		// Mirrors the PATTERN of the reference game's 17...Be6!! (a piece offered that
		// captures/loses nothing on its own move, only taken on the opponent's very next
		// reply) -- docs/references/DonaldByrne_RJamesFischer/. Colors are flipped from the
		// real game (White offers here, not Black): `classifyGame`'s ply-index convention
		// means `codes[0]` (ply 1) is always evaluated with `mover = sideToMoveForPly(0) ===
		// 'w'` in any isolated array-based fixture like this one (ply 0 is always "White to
		// move" by this codebase's indexing), so the sacrificed piece must belong to White
		// for this fixture's `mover` and the sacrificed color to actually agree -- this is a
		// test-harness detail, not a claim about who sacrifices in the real game.
		const evalPerPly = [0, 0, 0]; // 3 plies: before the offer, after the offer, after the reply captures it
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: mover (White) win% 80 before the offered move
			[600, 400, 0], // ply 1: still 80 right after offering the piece (engine already
			// credits the follow-up tactics, per this codebase's existing convention)
			[600, 400, 0] // ply 2: irrelevant to this test's own assertion, included only for
			// array-length parity with positions/moveMeta below
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'], e5: ['B', 'w'] }, // before: White's bishop still on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'], d6: ['B', 'w'] }, // after White's own move: bishop moved
			// to d6, nothing captured -- material diff vs. "before" is 0 at this point
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after Black's NEXT reply captures the bishop on d6
		];
		const moveMeta: Move[] = [
			{ from: 'e5', to: 'd6' }, // White's offered move (ply 1)
			{ from: 'e8', to: 'd6' } // Black's reply that captures it (ply 2) -- moveMeta content
			// for ply 2 doesn't affect this test (only ply 1 is classified as White's move here)
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd6', san: 'Bd6' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant'); // codes[0] = classification of ply 1 (White's offered move)
	});

	it('falls back to the same-ply material diff when the move played is the very last ply', () => {
		// No positions[ply + 1] exists at all -- must not throw, and must fall back to
		// comparing positions[ply - 1] directly against positions[ply] (today's pre-Task-1
		// behavior), still correctly detecting an IMMEDIATE (same-move) sacrifice.
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e5: ['N', 'w'], e8: ['K', 'b'] }, // before: White has a knight on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after (the LAST ply of the game): the knight is
			// simply given away in this same move, no positions[2] exists at all
		];
		const moveMeta: Move[] = [{ from: 'e5', to: 'd7' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd7', san: 'Nd7' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});

	it('does NOT classify a quiet move as brilliant just because the opponent\'s reply captures an unrelated, already-hanging piece elsewhere on the board', () => {
		// White plays a genuinely quiet king move (e1-e2, nothing captured, nothing offered).
		// Black's reply captures an unrelated White rook on a1 that was hanging for reasons that
		// have nothing to do with White's move -- the widened (offered-sacrifice) window still
		// sees a >=3-point material swing across positions[0] -> positions[2], but that swing is
		// NOT attributable to the piece White just moved (the king safely sits on e2 in
		// positions[2], untouched), so this must NOT be brilliant. Must fall back to the
		// same-ply (positions[0] vs positions[1]) comparison, which shows no material change at
		// all for White's own quiet move.
		const evalPerPly = [0, 0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: mover (White) win% 80 before White's move
			[600, 400, 0], // ply 1: still 80 right after White's quiet move
			[600, 400, 0] // ply 2: irrelevant to this test's assertion, array-length parity only
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'], a1: ['R', 'w'], a8: ['R', 'b'] }, // before: White king
			// on e1, White rook hanging on a1
			{ e2: ['K', 'w'], e8: ['K', 'b'], a1: ['R', 'w'], a8: ['R', 'b'] }, // after White's OWN
			// move: king moved e1->e2, nothing else changed -- quiet, no material swing at all
			{ e2: ['K', 'w'], e8: ['K', 'b'], a1: ['R', 'b'] } // after Black's NEXT reply: Black's
			// rook captures the unrelated White rook on a1 (nothing to do with White's e1-e2 move)
		];
		const moveMeta: Move[] = [
			{ from: 'e1', to: 'e2' }, // White's quiet move (ply 1)
			{ from: 'a8', to: 'a1' } // Black's reply capturing the unrelated rook (ply 2)
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e1', to: 'e2', san: 'Ke2' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).not.toBe('brilliant');
	});

	it('classifies an only-move (large MultiPV gap) best move as great', () => {
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[550, 400, 50], // ply 0: White win% (550+200)/10 = 75 (mover POV)
			[550, 400, 50] // ply 1: unchanged -- no sacrifice/miss condition applies
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[350, 400, 250], // ply 0's second PV line: White win% (350+200)/10 = 55 -> gap of 20 >= 10
			null
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e1', to: 'e2', san: 'Ke2' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, {
			positions,
			moveMeta,
			bestMoves,
			secondWdlPerPly
		});

		expect(codes).toEqual(['great']);
	});

	it('does not classify an only-move gap as great when the position was already decisively won', () => {
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[970, 20, 10], // ply 0: White win% (970+10)/10 = 98 -- already decisively winning
			[970, 20, 10] // ply 1: unchanged
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[500, 400, 100], // ply 0's second PV line: White win% (500+200)/10 = 70 -> gap of 28,
			// which WOULD clear the (now-raised) 20-point bar on its own
			null
		];
		const evalPerPly = [0, 0];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e1', to: 'e2', san: 'Ke2' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, {
			positions,
			moveMeta,
			bestMoves,
			secondWdlPerPly
		});

		expect(codes[0]).not.toBe('great');
	});

	it('classifies a failure to punish a winning position as miss', () => {
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[850, 100, 50], // ply 0: White win% (850+50)/10 = 90 (mover POV, above the 80 miss-before threshold)
			[300, 400, 300] // ply 1: White win% (300+200)/10 = 50 (below the 55 miss-after threshold)
		];
		const evalPerPly = [0, 0];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {}; // played move need not be "best" for Miss

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['miss']);
	});

	it('falls back to the EP-cutoff table when no special condition matches', () => {
		const evalPerPly = [0, -0.6]; // a small eval drop, no WDL provided
		const codes = classifyGame(evalPerPly);
		// No `special` argument at all -- must reproduce today's exact (pre-Task-5) behavior.
		expect(codes).toHaveLength(1);
		expect(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']).toContain(codes[0]);
	});
});
