import { describe, it, expect } from 'vitest';
import { classifyGame } from './classify';
import type { Wdl } from './accuracy';
import type { Move, Position } from '$lib/board/types';

/**
 * Regression fixture for the corrected diagnosis recorded when comparing
 * SecondBoard's Game Review output against chess.com's real output for
 * docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn (Byrne vs.
 * Fischer, 1956, "The Game of the Century"): chess.com credits Fischer's
 * 11...Na4 as Brilliant. Na4 is never actually captured in the game (White
 * plays 12.Qa3 instead of 12.Qxa4) -- it is a genuinely "hanging" piece
 * (attacked, undefended) that's still fine for Fischer, which only an
 * attack-based check (attacks.ts's isPieceHanging) can detect. An earlier
 * version of this fixture modeled 17...Be6 under the assumption that Be6 was
 * an "offered, later captured" sacrifice; that assumption was wrong (Be6 is
 * a defensive/developing move, not the sacrifice), which is why this fixture
 * was rewritten to model Na4 instead once the real pattern was identified.
 *
 * Only the material/attack relationship needed to clear Brilliant's own
 * guards is modeled -- the exact squares/pieces elsewhere on the board are
 * simplified down to just the two kings plus the pieces directly involved,
 * since classifyGame's special-class logic only reads
 * positions/moveMeta/bestMoves, never SAN or full legality.
 */
describe('reference game regression: Byrne vs. Fischer 1956, move 11...Na4', () => {
	it('classifies the declined knight sacrifice as brilliant', () => {
		// ply 0: position before 11...Na4 (Black to move, per the PGN's 11.Bg5 Na4).
		// ply 1: position right after 11...Na4 -- the knight is hanging on a4 (attacked by
		// Black's own... no: attacked by WHATEVER piece attacks it; see the color-flip note
		// below) but genuinely never captured in the real game (White plays 12.Qa3 instead).
		//
		// Colors are flipped from the real game (this fixture has White playing the Na4-pattern
		// move, not Black): `classifyGame`'s ply-index convention means `codes[0]` (ply 1) is
		// always evaluated with `mover = sideToMoveForPly(0) === 'w'` in any isolated
		// array-based fixture like this one (ply 0 is always "White to move" by this codebase's
		// indexing), so the hanging piece must belong to White for this fixture's `mover` and
		// the sacrificed color to actually agree -- a test-harness detail, not a claim about
		// who sacrifices in the real game.
		const evalPerPly = [0, 0];
		const wdlPerPly: (Wdl | null)[] = [
			[600, 350, 50], // ply 0: mover (White) win% (600+175)/10 = 77.5 before the move
			[600, 350, 50] // ply 1: still 77.5 right after -- the engine already credits the
			// follow-up tactics, matching this codebase's existing eval-at-ply convention
		];
		const positions: Position[] = [
			{ f1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], g8: ['K', 'b'] }, // before: knight on d4
			{ f1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], g8: ['K', 'b'] } // after: knight moved
			// to a4, attacked by the queen on a8 along the open a-file, no White defender --
			// genuinely hanging, yet never captured in the real game's actual continuation
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }]; // pattern-mirrors 11...Na4
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' } // engine agrees the move is best, matching
			// chess.com's own analysis of the real 11...Na4 (see
			// docs/references/DonaldByrne_RJamesFischer/ChessComAnalysis1.png, row 11)
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});
});
