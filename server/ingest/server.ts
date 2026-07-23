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

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, x-ingest-token'
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const json = JSON.stringify(body);
	res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
	res.end(json);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, config: ServerConfig): Promise<void> {
	// Browsers preflight cross-origin requests (the extension's background
	// fetch counts as one) with an OPTIONS request that never carries the
	// shared-secret header — it must be answered before the auth check.
	if (req.method === 'OPTIONS') {
		res.writeHead(204, CORS_HEADERS);
		res.end();
		return;
	}

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
}

export function createServer(config: ServerConfig) {
	return createHttpServer((req, res) => {
		// `handleRequest` is async; the http module never awaits or catches
		// what a request-listener callback returns, so if this async function
		// isn't invoked defensively, a rejection (e.g. the client aborting the
		// connection mid-upload, which readBody's Promise turns into a
		// rejection) becomes an unhandled rejection that crashes the entire
		// process under Node's default --unhandled-rejections=throw, killing
		// every other in-flight/queued request along with it.
		handleRequest(req, res, config).catch((error) => {
			if (res.headersSent) {
				res.destroy();
				return;
			}
			sendJson(res, 500, { error: 'internal error', detail: (error as Error).message });
		});
	});
}
