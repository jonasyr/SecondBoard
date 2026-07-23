import { describe, it, expect } from 'vitest';
import { parseAnalyzeGameMessage } from './parse-analyze-frame.js';

describe('parseAnalyzeGameMessage', () => {
	it('extracts data from a valid analyzeGame frame', () => {
		const raw = JSON.stringify({
			action: 'analyzeGame',
			data: { gameId: 'game-1', positions: [{ ply: 1 }] }
		});
		expect(parseAnalyzeGameMessage(raw)).toEqual({ gameId: 'game-1', positions: [{ ply: 1 }] });
	});

	it('ignores frames with a different action', () => {
		const raw = JSON.stringify({ action: 'progress', data: { gameId: 'game-1' } });
		expect(parseAnalyzeGameMessage(raw)).toBeNull();
	});

	it('ignores malformed JSON', () => {
		expect(parseAnalyzeGameMessage('not json')).toBeNull();
	});

	it('ignores an analyzeGame frame missing gameId or positions', () => {
		const raw = JSON.stringify({ action: 'analyzeGame', data: { gameId: 'game-1' } });
		expect(parseAnalyzeGameMessage(raw)).toBeNull();

		const raw2 = JSON.stringify({ action: 'analyzeGame', data: { positions: [] } });
		expect(parseAnalyzeGameMessage(raw2)).toBeNull();
	});
});
