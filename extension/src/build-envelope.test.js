import { describe, it, expect } from 'vitest';
import { extractGameId, buildEnvelope } from './build-envelope.js';

describe('extractGameId', () => {
	it('extracts the trailing numeric game id from a page URL', () => {
		expect(extractGameId('https://www.chess.com/game/live/170011037438')).toBe('170011037438');
		expect(extractGameId('https://www.chess.com/analysis/game/live/170011037438/review')).toBe(
			'170011037438'
		);
	});

	it('returns null when no numeric id is present', () => {
		expect(extractGameId('https://www.chess.com/home')).toBeNull();
	});
});

describe('buildEnvelope', () => {
	it('assigns ply by array index and attaches gameId/url/submittedBy/capturedAt', () => {
		const analyzeGameData = {
			analysisEngine: 'torch-human',
			positions: [{ color: 'white' }, { color: 'black' }]
		};

		const envelope = buildEnvelope(analyzeGameData, 'https://www.chess.com/game/live/170011037438', {
			submittedBy: 'brother'
		});

		expect(envelope.gameId).toBe('170011037438');
		expect(envelope.url).toBe('https://www.chess.com/game/live/170011037438');
		expect(envelope.submittedBy).toBe('brother');
		expect(envelope.positions).toEqual([
			{ color: 'white', ply: 0 },
			{ color: 'black', ply: 1 }
		]);
		expect(typeof envelope.capturedAt).toBe('string');
	});
});
