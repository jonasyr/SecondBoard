import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { openDb } from './db.js';
import { createServer } from './server.js';

describe('createServer', () => {
	let dir: string;
	let server: ReturnType<typeof createServer>;
	let baseUrl: string;
	const token = 'test-token';

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), 'calibration-ingest-server-test-'));
		const db = openDb(join(dir, 'test.sqlite'));
		server = createServer({ db, sharedToken: token });
		await new Promise<void>((resolve) => server.listen(0, resolve));
		const { port } = server.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${port}`;
	});

	afterEach(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		rmSync(dir, { recursive: true, force: true });
	});

	it('rejects requests without the shared token', async () => {
		const response = await fetch(`${baseUrl}/export`);
		expect(response.status).toBe(401);
	});

	it('rejects a malformed /ingest body', async () => {
		const response = await fetch(`${baseUrl}/ingest`, {
			method: 'POST',
			headers: { 'x-ingest-token': token, 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'missing gameId' })
		});
		expect(response.status).toBe(400);
	});

	it('stores a valid game and returns it via /export', async () => {
		const payload = {
			gameId: 'game-1',
			url: 'https://www.chess.com/game/live/1',
			positions: [{ ply: 1, color: 'white', classificationName: 'book', caps2: 100 }],
			tallies: { white: {}, black: {} },
			submittedBy: 'brother',
			capturedAt: '2026-07-23T00:00:00.000Z'
		};

		const ingestResponse = await fetch(`${baseUrl}/ingest`, {
			method: 'POST',
			headers: { 'x-ingest-token': token, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		expect(ingestResponse.status).toBe(200);

		const exportResponse = await fetch(`${baseUrl}/export`, {
			headers: { 'x-ingest-token': token }
		});
		expect(exportResponse.status).toBe(200);
		const body = (await exportResponse.json()) as { games: Array<{ gameId: string }> };
		expect(body.games).toHaveLength(1);
		expect(body.games[0].gameId).toBe('game-1');
	});
});
