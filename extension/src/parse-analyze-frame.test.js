import { describe, it, expect } from 'vitest';
import { parseAnalyzeGameMessage } from './parse-analyze-frame.js';

describe('parseAnalyzeGameMessage', () => {
	it('extracts data from a valid analyzeGame frame', () => {
		const raw = JSON.stringify({
			action: 'analyzeGame',
			data: { positions: [{ ply: 1 }] }
		});
		expect(parseAnalyzeGameMessage(raw)).toEqual({ positions: [{ ply: 1 }] });
	});

	it('ignores frames with a different action', () => {
		const raw = JSON.stringify({ action: 'progress', data: { positions: [] } });
		expect(parseAnalyzeGameMessage(raw)).toBeNull();
	});

	it('ignores malformed JSON', () => {
		expect(parseAnalyzeGameMessage('not json')).toBeNull();
	});

	it('ignores an analyzeGame frame missing positions', () => {
		const raw = JSON.stringify({ action: 'analyzeGame', data: {} });
		expect(parseAnalyzeGameMessage(raw)).toBeNull();
	});

	it('strips metaData (which can carry a live session token) from a real-shaped frame', () => {
		const raw = JSON.stringify({
			action: 'analyzeGame',
			data: {
				analysisEngine: 'torch-human',
				positions: [{ color: 'white', classificationName: 'book', caps2: 100 }],
				tallies: { white: {}, black: {} },
				metaData: {
					clientRequest: {
						source: { gameId: 170011037438, token: 'super-secret-session-token' }
					}
				}
			}
		});

		const result = parseAnalyzeGameMessage(raw);
		expect(result.metaData).toBeUndefined();
		expect(JSON.stringify(result)).not.toContain('super-secret-session-token');
		expect(result.positions).toEqual([{ color: 'white', classificationName: 'book', caps2: 100 }]);
	});
});
