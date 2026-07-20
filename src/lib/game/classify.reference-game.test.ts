import { describe, it, expect } from 'vitest';
import { classifyGame } from './classify';
import type { Wdl } from './accuracy';
import type { Move, Position } from '$lib/board/types';

/**
 * Regression fixture for the diagnosis recorded when comparing SecondBoard's
 * Game Review output against chess.com's real output for
 * docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn (Byrne vs.
 * Fischer, 1956, "The Game of the Century"): chess.com credits Fischer's
 * 17...Be6!! as Brilliant; before this plan's Task 1 fix, SecondBoard's
 * same-ply-only material-sacrifice check misclassified it as Great instead,
 * because Be6 itself captures/loses nothing -- White only captures the
 * offered bishop on the very next move (18.Bxb6). This test isolates just
 * that one real position (not the full 41-move game) as a minimal,
 * hand-built fixture so a future regression in the sacrifice-window logic
 * is caught immediately, without needing the full real engine pipeline.
 *
 * Only the material relationship (a bishop offered on one move, captured on
 * the opponent's very next move) and the win%s needed to clear Brilliant's
 * own guards are modeled -- the exact squares/pieces elsewhere on the board
 * are simplified down to just the two kings, since classifyGame's special-
 * class logic only reads positions/moveMeta/bestMoves, never SAN or full
 * legality. Colors are flipped from the real game (this fixture has White
 * offering the piece, not Black): `classifyGame`'s ply-index convention
 * means `codes[0]` (ply 1) is always evaluated with `mover =
 * sideToMoveForPly(0) === 'w'` in any isolated array-based fixture like this
 * one (ply 0 is always "White to move" by this codebase's indexing), so the
 * offered piece must belong to White for this fixture's `mover` and the
 * sacrificed color to actually agree -- a test-harness detail, not a claim
 * about who sacrifices in the real game.
 */
describe('reference game regression: Byrne vs. Fischer 1956, move 17...Be6 pattern', () => {
	it('classifies an offered bishop sacrifice (the 17...Be6 pattern) as brilliant, not great', () => {
		// ply 0: position before the offer (per the PGN's 17.Kf1 Be6 -- pattern only, see
		// the color-flip note above).
		// ply 1: position right after the offering move (nothing captured yet).
		// ply 2: position right after the opponent's reply captures the offered bishop
		// (mirroring 18.Bxb6's role: punishing/accepting the offer one ply later).
		const evalPerPly = [0, 0, 0];
		const wdlPerPly: (Wdl | null)[] = [
			[600, 350, 50], // ply 0: mover (White) win% (600+175)/10 = 77.5 before offering the bishop
			[600, 350, 50], // ply 1: still 77.5 right after -- the engine already credits the
			// follow-up combination, matching this codebase's existing eval-at-ply convention
			[600, 350, 50] // ply 2: irrelevant to ply 1's own classification, included only for
			// array-length parity with positions/moveMeta below
		];
		const positions: Position[] = [
			{ f1: ['K', 'w'], g8: ['K', 'b'], e5: ['B', 'w'] }, // before the offer: bishop still on e5
			{ f1: ['K', 'w'], g8: ['K', 'b'], d6: ['B', 'w'] }, // after the offering move: bishop
			// moved, nothing captured -- material diff vs. "before" is exactly 0 at this ply
			{ f1: ['K', 'w'], g8: ['K', 'b'] } // after the opponent's reply captured the bishop
		];
		const moveMeta: Move[] = [
			{ from: 'e5', to: 'd6' }, // the offering move (pattern-mirrors 17...Be6)
			{ from: 'g8', to: 'd6' } // the reply that captures it (pattern-mirrors 18.Bxb6) --
			// moveMeta content for ply 2 doesn't affect this test (only ply 1 is classified
			// here); classifyGame reads only positions[ply+1]'s resulting board for ply 1
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd6', san: 'Bd6' } // engine agrees the offer is best, matching
			// chess.com's own "Best" star on the real 17...Be6 (see
			// docs/references/DonaldByrne_RJamesFischer/ChessComAnalysis1.png, row 17)
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});
});
