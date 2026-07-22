import { describe, it, expect } from 'vitest';
import { validateIngestPayload } from './validate.js';

describe('validateIngestPayload', () => {
	it('accepts a minimal valid payload', () => {
		const result = validateIngestPayload({
			gameId: 'g1',
			url: 'https://www.chess.com/game/live/1',
			positions: [],
			tallies: {}
		});
		expect(result).toEqual({ ok: true });
	});

	it('rejects a non-object body', () => {
		expect(validateIngestPayload(null)).toEqual({
			ok: false,
			error: 'body must be a JSON object'
		});
		expect(validateIngestPayload('nope')).toEqual({
			ok: false,
			error: 'body must be a JSON object'
		});
	});

	it('rejects a missing gameId', () => {
		const result = validateIngestPayload({ url: 'u', positions: [], tallies: {} });
		expect(result).toEqual({
			ok: false,
			error: 'gameId is required and must be a non-empty string'
		});
	});

	it('rejects positions that is not an array', () => {
		const result = validateIngestPayload({ gameId: 'g1', url: 'u', positions: 'nope', tallies: {} });
		expect(result).toEqual({ ok: false, error: 'positions is required and must be an array' });
	});

	it('rejects a missing tallies object', () => {
		const result = validateIngestPayload({ gameId: 'g1', url: 'u', positions: [] });
		expect(result).toEqual({ ok: false, error: 'tallies is required and must be an object' });
	});
});
