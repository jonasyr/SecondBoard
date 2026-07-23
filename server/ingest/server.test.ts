import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, type AddressInfo } from 'node:net';
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

	it('answers a CORS preflight OPTIONS request without requiring the shared token', async () => {
		const response = await fetch(`${baseUrl}/ingest`, { method: 'OPTIONS' });
		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('access-control-allow-headers')).toContain('x-ingest-token');
	});

	it('includes CORS headers on authenticated responses', async () => {
		const response = await fetch(`${baseUrl}/export`, { headers: { 'x-ingest-token': token } });
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
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

	it('returns 500 instead of crashing when storing a payload fails at the database layer', async () => {
		const payload = {
			gameId: 'game-2',
			url: 'https://www.chess.com/game/live/2',
			positions: [
				{ ply: 0, color: 'white' },
				{ ply: 0, color: 'black' }
			],
			tallies: {}
		};

		const response = await fetch(`${baseUrl}/ingest`, {
			method: 'POST',
			headers: { 'x-ingest-token': token, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		expect(response.status).toBe(500);
	});

	it('survives a client aborting mid-upload instead of crashing the process', async () => {
		const { port } = server.address() as AddressInfo;

		await new Promise<void>((resolve) => {
			const socket = connect(port, '127.0.0.1', () => {
				socket.write(
					'POST /ingest HTTP/1.1\r\n' +
						'Host: 127.0.0.1\r\n' +
						`x-ingest-token: ${token}\r\n` +
						'Content-Type: application/json\r\n' +
						'Content-Length: 1000\r\n' +
						'\r\n' +
						'{"gameId":"aborted-upload"' // far short of the declared 1000 bytes
				);
				setTimeout(() => {
					socket.destroy();
					resolve();
				}, 50);
			});
			socket.on('error', () => {}); // ECONNRESET etc. from the deliberate abort — expected
		});

		// Give the server's rejection handler a tick to run before asserting it's still alive.
		await new Promise((resolve) => setTimeout(resolve, 50));

		const response = await fetch(`${baseUrl}/export`, { headers: { 'x-ingest-token': token } });
		expect(response.status).toBe(200);
	});
});
