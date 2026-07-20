import { describe, it, expect, vi, beforeEach } from 'vitest';

const { analyzeFen } = vi.hoisted(() => ({ analyzeFen: vi.fn() }));
vi.mock('$lib/api/engine', () => ({ analyzeFen }));

import { loadRealAnalysis } from './engine-analysis';
import { fullmoveNumberForPly, sideToMoveForPly } from './notation';
import type { Position } from '$lib/board/types';

// Self-contained fixture, independent of any "sample game" data: 32 mostly-empty
// placeholder positions (analyzeFen is mocked out entirely below, so these tests
// only care about array length/count), except index 13 which carries a black
// bishop on c8 so the "maps each analyzed position's best move..." test below can
// exercise moveToSan's real (non-mocked) SAN-labeling logic for a bishop move.
const testPositions: Position[] = Array.from({ length: 32 }, () => ({}));
testPositions[13] = { c8: ['B', 'b'] };

describe('loadRealAnalysis', () => {
	beforeEach(() => {
		analyzeFen.mockReset();
	});

	it('produces one evalPerPly entry per position, normalized to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 50,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: []
		}));

		const { evalPerPly } = await loadRealAnalysis(testPositions);

		expect(evalPerPly).toHaveLength(testPositions.length);
		expect(evalPerPly[0]).toBeCloseTo(0.5); // ply 0: White to move, +50cp -> +0.50 White POV
		expect(evalPerPly[1]).toBeCloseTo(-0.5); // ply 1: Black to move, +50cp for Black -> -0.50 White POV
	});

	it('maps each analyzed position\'s best move onto the following ply (matches BEST_MOVES[14] shape)', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis(testPositions);

		expect(bestMoves[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
	});

	it('does not add a bestMoves entry for the position after the final ply', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis(testPositions);

		expect(bestMoves[testPositions.length]).toBeUndefined();
	});

	it('reports a large positive eval for a favorable mate for the mover (White to move, ply 0)', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 100_000, isMate: true, bestMoveUci: 'e2e4', pv: [] });

		const { evalPerPly } = await loadRealAnalysis(testPositions);

		expect(evalPerPly[0]).toBeGreaterThan(50); // ply 0: White to move, mate FOR mover -> large positive
	});

	it('reports a large negative eval for a losing mate for the mover (White to move, ply 0)', async () => {
		// Regression test: evalCp is already signed relative to the mover by the Rust
		// side (positive = mate for the mover, negative = mover is being mated). If
		// toWhitePovEval discards that sign and hardcodes a positive magnitude for any
		// mate score, this case (mover is being mated) would incorrectly come out positive.
		analyzeFen.mockResolvedValue({ evalCp: -100_000, isMate: true, bestMoveUci: 'e2e4', pv: [] });

		const { evalPerPly } = await loadRealAnalysis(testPositions);

		expect(evalPerPly[0]).toBeLessThan(-50); // ply 0: White to move, mover IS being mated -> large negative
	});

	it('bounds concurrent analyzeFen calls to 4 in-flight at a time, preserving result order', async () => {
		const BATCH_SIZE = 4;
		let inFlight = 0;
		let maxInFlight = 0;

		analyzeFen.mockImplementation(async (fen: string) => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			// Yield a couple microtask turns so calls dispatched in the same batch
			// overlap in flight before resolving, without relying on real timers.
			await Promise.resolve();
			await Promise.resolve();
			inFlight--;

			// Encode which position this call was for into the result so we can
			// verify ordering isn't scrambled by the batching.
			const ply = fen.split(' ')[5]; // fullmove number, used only as a distinguishing tag
			return { evalCp: Number(ply), isMate: false, bestMoveUci: 'e2e4', pv: [] };
		});

		const { evalPerPly } = await loadRealAnalysis(testPositions);

		expect(maxInFlight).toBeLessThanOrEqual(BATCH_SIZE);
		expect(maxInFlight).toBeGreaterThan(1); // sanity check: calls really do overlap within a batch

		// Ordering check: evalPerPly[ply] must reflect testPositions[ply]'s own analysis
		// (fullmove number for that ply), not some other position's result.
		evalPerPly.forEach((_, ply) => {
			const expectedFullmove = fullmoveNumberForPly(ply);
			const expectedSign = sideToMoveForPly(ply) === 'w' ? 1 : -1;
			expect(evalPerPly[ply]).toBeCloseTo((expectedFullmove / 100) * expectedSign);
		});
	});

	it('produces one wdlPerPly entry per position, flipped to White POV', async () => {
		analyzeFen.mockImplementation(async (fen: string) => ({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: [600, 300, 100] // side-to-move POV, favorable for whoever is to move
		}));

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly).toHaveLength(testPositions.length);
		expect(wdlPerPly[0]).toEqual([600, 300, 100]); // ply 0: White to move, so no flip
		expect(wdlPerPly[1]).toEqual([100, 300, 600]); // ply 1: Black to move, so w/l swap to White POV
	});

	it('reports null wdlPerPly entries for positions where the engine did not report wdl', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'e2e4', pv: [], wdl: null });

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly.every((w) => w === null)).toBe(true);
	});
});
