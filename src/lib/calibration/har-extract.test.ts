import { describe, it, expect } from 'vitest';
import { extractGameAnalysis, buildFixture } from './har-extract';

function syntheticHar() {
	return {
		log: {
			entries: [
				{ request: { url: 'https://www.chess.com/callback/bucket' } },
				{
					request: { url: 'wss://analysis.chess.com/v1/legacy/game-analysis' },
					_webSocketMessages: [
						{
							type: 'send',
							data: JSON.stringify({ action: 'gameAnalysis', game: { pgn: '1. e4 e5' } })
						},
						{ type: 'receive', data: JSON.stringify({ action: 'progress', progress: 0.5 }) },
						{
							type: 'receive',
							data: JSON.stringify({
								action: 'analyzeGame',
								data: {
									analysisEngine: 'torch-human',
									book: { code: 'C20', name: 'Test Opening', depth: 2, score: 0.1 },
									bookPly: 2,
									tallies: { white: { best: 1 }, black: { best: 1 } },
									positions: [
										{
											color: null,
											classificationName: null,
											playedMove: null,
											difference: null,
											caps2: null
										},
										{
											color: 'white',
											classificationName: 'book',
											playedMove: { moveLan: 'e2e4' },
											difference: 0,
											caps2: 100
										}
									]
								}
							})
						},
						{ type: 'receive', data: JSON.stringify({ action: 'done' }) }
					]
				}
			]
		}
	};
}

describe('extractGameAnalysis', () => {
	it("finds the analysis WebSocket entry and returns its pgn + analyzeGame data", () => {
		const result = extractGameAnalysis(syntheticHar());
		expect(result?.pgn).toBe('1. e4 e5');
		expect(result?.data.analysisEngine).toBe('torch-human');
	});

	it('returns null when no analysis.chess.com entry exists', () => {
		const har = { log: { entries: [{ request: { url: 'https://www.chess.com/x' } }] } };
		expect(extractGameAnalysis(har)).toBeNull();
	});

	it('returns null when the analyzeGame frame never arrives (capture ended too early)', () => {
		const har = syntheticHar();
		har.log.entries[1]._webSocketMessages = har.log.entries[1]._webSocketMessages!.slice(0, 2);
		expect(extractGameAnalysis(har)).toBeNull();
	});
});

describe('buildFixture', () => {
	it('maps the raw analyzeGame data into the CalibrationFixture shape', () => {
		const extracted = extractGameAnalysis(syntheticHar())!;
		const fixture = buildFixture(extracted, {
			url: 'https://www.chess.com/game/live/1',
			gameId: '1',
			capturedAt: '2026-07-22T00:00:00.000Z'
		});

		expect(fixture.pgn).toBe('1. e4 e5');
		expect(fixture.bookPly).toBe(2);
		expect(fixture.positions).toHaveLength(2);
		expect(fixture.positions[1]).toEqual({
			ply: 1,
			color: 'white',
			classificationName: 'book',
			playedMoveLan: 'e2e4',
			difference: 0,
			caps2: 100
		});
	});
});
