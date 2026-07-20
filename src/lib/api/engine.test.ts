import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { analyzeFen } from './engine';

describe('analyzeFen', () => {
	it('invokes the analyze_fen command with the given FEN and returns its result', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: ['e2e4', 'e7e5'],
			wdl: [500, 400, 100]
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(invoke).toHaveBeenCalledWith('analyze_fen', {
			fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		});
		expect(result.bestMoveUci).toBe('e2e4');
		expect(result.evalCp).toBe(34);
		expect(result.wdl).toEqual([500, 400, 100]);
	});

	it('passes through a null wdl when the engine did not report one', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(result.wdl).toBeNull();
	});
});
