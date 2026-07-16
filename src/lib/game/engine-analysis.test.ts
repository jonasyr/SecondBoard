import { describe, it, expect, vi, beforeEach } from 'vitest';

const { analyzeFen } = vi.hoisted(() => ({ analyzeFen: vi.fn() }));
vi.mock('$lib/api/engine', () => ({ analyzeFen }));

import { loadRealAnalysis } from './engine-analysis';
import { SAMPLE_POSITIONS } from './mock-data';
import { fullmoveNumberForPly, sideToMoveForPly } from './notation';

describe('loadRealAnalysis', () => {
	beforeEach(() => {
		analyzeFen.mockReset();
	});

	it('produces one evalPerPly entry per mock position, normalized to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 50,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: []
		}));

		const { evalPerPly } = await loadRealAnalysis();

		expect(evalPerPly).toHaveLength(SAMPLE_POSITIONS.length);
		expect(evalPerPly[0]).toBeCloseTo(0.5); // ply 0: White to move, +50cp -> +0.50 White POV
		expect(evalPerPly[1]).toBeCloseTo(-0.5); // ply 1: Black to move, +50cp for Black -> -0.50 White POV
	});

	it('maps each analyzed position\'s best move onto the following ply (matches BEST_MOVES[14] shape)', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis();

		expect(bestMoves[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
	});

	it('does not add a bestMoves entry for the position after the final ply', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'c8g4', pv: [] });

		const { bestMoves } = await loadRealAnalysis();

		expect(bestMoves[SAMPLE_POSITIONS.length]).toBeUndefined();
	});

	it('reports a large positive eval for a favorable mate for the mover (White to move, ply 0)', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 100_000, isMate: true, bestMoveUci: 'e2e4', pv: [] });

		const { evalPerPly } = await loadRealAnalysis();

		expect(evalPerPly[0]).toBeGreaterThan(50); // ply 0: White to move, mate FOR mover -> large positive
	});

	it('reports a large negative eval for a losing mate for the mover (White to move, ply 0)', async () => {
		// Regression test: evalCp is already signed relative to the mover by the Rust
		// side (positive = mate for the mover, negative = mover is being mated). If
		// toWhitePovEval discards that sign and hardcodes a positive magnitude for any
		// mate score, this case (mover is being mated) would incorrectly come out positive.
		analyzeFen.mockResolvedValue({ evalCp: -100_000, isMate: true, bestMoveUci: 'e2e4', pv: [] });

		const { evalPerPly } = await loadRealAnalysis();

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

		const { evalPerPly } = await loadRealAnalysis();

		expect(maxInFlight).toBeLessThanOrEqual(BATCH_SIZE);
		expect(maxInFlight).toBeGreaterThan(1); // sanity check: calls really do overlap within a batch

		// Ordering check: evalPerPly[ply] must reflect SAMPLE_POSITIONS[ply]'s own analysis
		// (fullmove number for that ply), not some other position's result.
		evalPerPly.forEach((_, ply) => {
			const expectedFullmove = fullmoveNumberForPly(ply);
			const expectedSign = sideToMoveForPly(ply) === 'w' ? 1 : -1;
			expect(evalPerPly[ply]).toBeCloseTo((expectedFullmove / 100) * expectedSign);
		});
	});
});
