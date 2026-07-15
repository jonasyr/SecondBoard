import { describe, it, expect, vi, beforeEach } from 'vitest';

const { analyzeFen } = vi.hoisted(() => ({ analyzeFen: vi.fn() }));
vi.mock('$lib/api/engine', () => ({ analyzeFen }));

import { loadRealAnalysis } from './engine-analysis';
import { MOCK_POSITIONS } from './mock-data';

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

		expect(evalPerPly).toHaveLength(MOCK_POSITIONS.length);
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

		expect(bestMoves[MOCK_POSITIONS.length]).toBeUndefined();
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
});
