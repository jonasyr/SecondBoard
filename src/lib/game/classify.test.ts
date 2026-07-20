import { describe, it, expect } from 'vitest';
import { classifyMoveByEpLoss, classifyGame } from './classify';
import type { Move, Position } from '$lib/board/types';

describe('classifyMoveByEpLoss', () => {
	it('classifies exactly 0 loss as best', () => {
		expect(classifyMoveByEpLoss(0)).toBe('best');
	});

	it("classifies the upper edge of each band using Chess.com's exact published cutoffs", () => {
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
	it("returns one classification per move, best when the mover's win% never worsens", () => {
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

	it("attributes each ply's classification to the correct mover (White odd ply positions, Black even)", () => {
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
		const wdlPerPly: Array<[number, number, number] | null> = [
			[600, 300, 100],
			[0, 0, 1000]
		];
		const withWdl = classifyGame(evalPerPly, wdlPerPly);
		expect(withoutWdl[0]).not.toBe('blunder');
		expect(withWdl[0]).toBe('blunder');
	});
});

describe('classifyGame with special classes', () => {
	// 3 plies: ply0 (before any move) -> ply1 (after White's move) -> ply2 (after Black's move).
	// evalPerPly / wdlPerPly are White-POV win% inputs; the fixture positions/moves below are
	// only wired up to exercise the Brilliant/Great/Miss branches, not to represent a legal game.

	it('classifies an immediately-hanging near-best move as brilliant', () => {
		// White's knight lands on a4, attacked by Black's queen on a8 along the open a-file,
		// with no White defender of a4 -- classic hanging piece, worth a minor piece (3).
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: mover (White) win% 80 before the sacrifice
			[600, 400, 0] // ply 1: still 80 right after -- the engine already credits the
			// follow-up tactics, matching this codebase's existing eval-at-ply convention
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }, // before: knight on d4
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] } // after: knight moved
			// to a4, hanging to the queen on a8 along the open a-file
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['brilliant']);
	});

	it('classifies a declined sacrifice (piece hanging but never actually captured) as brilliant', () => {
		// Mirrors the reference game's 11...Na4 exactly (docs/references/DonaldByrne_RJamesFischer/):
		// the knight is genuinely hanging (attacked, undefended) but the opponent's ACTUAL next
		// move (modeled here, though classifyGame never even looks at ply 2 for this ply's own
		// classification) does not capture it. The old material-diff-window approach could never
		// detect this since no capture ever occurs on the board; attack-based detection doesn't
		// need one.
		const evalPerPly = [0, 0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }, // knight hanging on a4
			{ e1: ['K', 'w'], a4: ['N', 'w'], d1: ['Q', 'b'], e8: ['K', 'b'] } // opponent declines the
			// knight, plays elsewhere instead (queen repositions to d1) -- the knight is still
			// sitting on a4, still hanging, simply never taken
		];
		const moveMeta: Move[] = [
			{ from: 'd4', to: 'a4' },
			{ from: 'a8', to: 'd1' } // the opponent's actual reply -- NOT a capture of a4
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant'); // codes[0] = classification of ply 1 (the Na4-pattern move)
	});

	it('does not classify a quiet, adequately-defended move as brilliant', () => {
		// The knight on a4 is attacked by the queen on a8, but also defended once by White's own
		// rook on a1 -- attackers (1) do not exceed defenders (1), so it is not "hanging".
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a1: ['R', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a1: ['R', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).not.toEqual(['brilliant']);
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
