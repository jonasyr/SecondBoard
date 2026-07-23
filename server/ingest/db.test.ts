import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, upsertGame, getAllGames } from './db.js';

describe('db', () => {
	let dir: string;
	let dbPath: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'calibration-ingest-test-'));
		dbPath = join(dir, 'test.sqlite');
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it('inserts a new game and its positions', () => {
		const db = openDb(dbPath);
		upsertGame(
			db,
			{
				gameId: 'game-1',
				url: 'https://www.chess.com/game/live/1',
				positions: [
					{ ply: 1, color: 'white', classificationName: 'book', caps2: 100 },
					{ ply: 2, color: 'black', classificationName: 'best', caps2: 95 }
				],
				tallies: { white: {}, black: {} },
				analysisEngine: 'torch-human',
				CAPS: { white: { all: 64.88 }, black: { all: 58.39 } }
			},
			{ submittedBy: 'brother', capturedAt: '2026-07-23T00:00:00.000Z' }
		);

		const games = getAllGames(db);
		expect(games).toHaveLength(1);
		expect(games[0]).toMatchObject({
			gameId: 'game-1',
			submittedBy: 'brother',
			capturedAt: '2026-07-23T00:00:00.000Z'
		});

		const positionRows = db.prepare('SELECT * FROM positions WHERE game_id = ?').all('game-1');
		expect(positionRows).toHaveLength(2);
	});

	it('overwrites an existing game on re-submission instead of duplicating', () => {
		const db = openDb(dbPath);
		const basePayload = {
			gameId: 'game-1',
			url: 'https://www.chess.com/game/live/1',
			positions: [{ ply: 1, color: 'white', classificationName: 'book', caps2: 100 }],
			tallies: { white: {}, black: {} }
		};

		upsertGame(db, basePayload, { submittedBy: 'brother', capturedAt: '2026-07-23T00:00:00.000Z' });
		upsertGame(
			db,
			{
				...basePayload,
				positions: [{ ply: 1, color: 'white', classificationName: 'best', caps2: 90 }]
			},
			{ submittedBy: 'brother', capturedAt: '2026-07-23T01:00:00.000Z' }
		);

		const games = getAllGames(db);
		expect(games).toHaveLength(1);
		expect(games[0].capturedAt).toBe('2026-07-23T01:00:00.000Z');

		const positionRows = db
			.prepare('SELECT classification_name FROM positions WHERE game_id = ?')
			.all('game-1');
		expect(positionRows).toEqual([{ classification_name: 'best' }]);
	});

	it('filters by capturedAt when since is provided', () => {
		const db = openDb(dbPath);
		upsertGame(
			db,
			{ gameId: 'old', url: 'u', positions: [], tallies: {} },
			{ submittedBy: 'brother', capturedAt: '2026-07-20T00:00:00.000Z' }
		);
		upsertGame(
			db,
			{ gameId: 'new', url: 'u', positions: [], tallies: {} },
			{ submittedBy: 'brother', capturedAt: '2026-07-23T00:00:00.000Z' }
		);

		const games = getAllGames(db, '2026-07-22T00:00:00.000Z');
		expect(games.map((g) => g.gameId)).toEqual(['new']);
	});

	it('stores non-scalar fields (booleans, objects) instead of crashing the insert', () => {
		const db = openDb(dbPath);

		expect(() =>
			upsertGame(
				db,
				{
					gameId: 'game-1',
					url: 'https://www.chess.com/game/live/1',
					positions: [
						{
							ply: 1,
							color: 'white',
							// real chess.com payloads aren't validated beyond
							// gameId/url/positions/tallies, so a boolean or
							// nested object here must not crash the insert.
							difference: false,
							caps2: { cp: 20 }
						}
					],
					tallies: { white: {}, black: {} },
					bookPly: true,
					CAPS: { white: { all: { value: 64.88 } } }
				},
				{ submittedBy: 'brother', capturedAt: '2026-07-23T00:00:00.000Z' }
			)
		).not.toThrow();

		const games = getAllGames(db);
		expect(games).toHaveLength(1);

		const positionRows = db.prepare('SELECT * FROM positions WHERE game_id = ?').all('game-1');
		expect(positionRows).toHaveLength(1);
	});
});
