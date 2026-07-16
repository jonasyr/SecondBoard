import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { parsePgn } from './pgn';

describe('parsePgn', () => {
	it('invokes the parse_pgn command with the given PGN text and returns its result', async () => {
		invoke.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{ e2: ['P', 'w'] }, { e4: ['P', 'w'] }],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		const result = await parsePgn('1. e4 e5');

		expect(invoke).toHaveBeenCalledWith('parse_pgn', { pgn: '1. e4 e5' });
		expect(result.sanList).toEqual(['e4', 'e5']);
		expect(result.moves).toEqual([{ from: 'e2', to: 'e4' }]);
	});
});
