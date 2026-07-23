import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type Database from 'better-sqlite3';
import { validateIngestPayload } from './validate.js';
import { upsertGame, getAllGames, type GamePayload } from './db.js';

export interface ServerConfig {
	db: Database.Database;
	sharedToken: string;
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
		req.on('error', reject);
	});
}

function isAuthorized(req: IncomingMessage, sharedToken: string): boolean {
	return req.headers['x-ingest-token'] === sharedToken;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const json = JSON.stringify(body);
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(json);
}

export function createServer(config: ServerConfig) {
	return createHttpServer(async (req, res) => {
		if (!isAuthorized(req, config.sharedToken)) {
			sendJson(res, 401, { error: 'unauthorized' });
			return;
		}

		if (req.method === 'POST' && req.url === '/ingest') {
			const rawBody = await readBody(req);
			let parsed: unknown;
			try {
				parsed = JSON.parse(rawBody);
			} catch {
				sendJson(res, 400, { error: 'invalid JSON' });
				return;
			}

			const validation = validateIngestPayload(parsed);
			if (!validation.ok) {
				sendJson(res, 400, { error: validation.error });
				return;
			}

			const payload = parsed as GamePayload;
			const submittedBy = typeof payload.submittedBy === 'string' ? payload.submittedBy : 'unknown';
			const capturedAt =
				typeof payload.capturedAt === 'string' ? payload.capturedAt : new Date().toISOString();

			try {
				upsertGame(config.db, payload, { submittedBy, capturedAt });
			} catch (error) {
				sendJson(res, 500, { error: 'failed to store game', detail: (error as Error).message });
				return;
			}
			sendJson(res, 200, { ok: true });
			return;
		}

		if (req.method === 'GET' && req.url?.startsWith('/export')) {
			const url = new URL(req.url, 'http://localhost');
			const since = url.searchParams.get('since') ?? undefined;
			const games = getAllGames(config.db, since);
			sendJson(res, 200, { games });
			return;
		}

		sendJson(res, 404, { error: 'not found' });
	});
}
