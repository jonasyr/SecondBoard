# Calibration Capture Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a second contributor's Chrome browsing of chess.com Game Reviews automatically flow into a persistent SQLite store on the user's home server, with zero manual steps per game.

**Architecture:** A self-contained Chrome extension (`extension/`) patches `WebSocket` on chess.com's Game Review page to observe the `analyzeGame` frame, then POSTs it to a self-contained Node ingest/export server (`server/ingest/`) that upserts into SQLite keyed on `gameId`. Both are independent sub-projects with their own `package.json`/tooling, untouched by and not touching the main SvelteKit/Tauri app.

**Tech Stack:** Plain JS (no build step) for the extension; TypeScript + `better-sqlite3` run via `tsx` for the server; Vitest for both; Docker for server deployment.

## Global Constraints

- Never store, log, or forward chess.com's HTTP auth cookie/bearer token anywhere in this pipeline — only the WebSocket message *body* (the `analyzeGame` frame's `data` object) is ever captured or transmitted, never HTTP headers.
- The ingest/export server must never be exposed to the public internet (no port-forwarding, no public DNS) — it is LAN-only, and a single shared-secret header (`x-ingest-token`) is its sole access control. Do not add TLS, user accounts, or any heavier auth.
- The extension is installed via Chrome's "Load unpacked" developer mode only — no Chrome Web Store packaging/signing in scope.
- Every stored game's full raw payload is kept verbatim (a `raw_json` column) in addition to indexed derived columns, so nothing is lost by under-deciding the schema.
- `server/ingest/` and `extension/` are self-contained sub-projects, each with its own `package.json`, `tsconfig.json`/`vitest.config.ts` as needed. Do **not** modify the root `package.json`, `vitest.config.ts`, `eslint.config.js`, or `tsconfig.json` — these two components are deliberately isolated from the main app's tooling.
- Migrating `scripts/calibration/calibrate.ts`/`sweep.ts`/`diff-engine.ts` to read from this SQLite store instead of the single `game-1.json` fixture is explicitly **out of scope** for this plan.
- `better-sqlite3` is a native module requiring build tools (`python3`, `make`, `g++`) to compile during `pnpm install`. If a task's sandbox lacks these and installation/compilation fails, the implementer should still write all code and tests correctly, report status `DONE_WITH_CONCERNS`, and note that `pnpm test` could not be run in-sandbox — verification then happens on the user's own machine.

---

### Task 1: Ingest server scaffold + SQLite schema/db module

**Files:**
- Create: `server/ingest/package.json`
- Create: `server/ingest/tsconfig.json`
- Create: `server/ingest/vitest.config.ts`
- Create: `server/ingest/db.ts`
- Test: `server/ingest/db.test.ts`

**Interfaces:**
- Produces (for Tasks 3–4): from `server/ingest/db.ts`:
  - `interface PositionPayload { ply: number; color?: string; classificationName?: string; playedMove?: { moveLan?: string }; difference?: number; caps2?: number; fen?: string; bestMove?: string; [key: string]: unknown; }`
  - `interface GamePayload { gameId: string; url: string; positions: PositionPayload[]; tallies: Record<string, unknown>; analysisEngine?: string; book?: { code?: string }; bookPly?: number; CAPS?: { white?: { all?: number }; black?: { all?: number } }; reportCard?: { white?: { effectiveElo?: number }; black?: { effectiveElo?: number } }; [key: string]: unknown; }`
  - `interface IngestMeta { submittedBy: string; capturedAt: string; }`
  - `function openDb(path: string): Database.Database`
  - `function upsertGame(db: Database.Database, payload: GamePayload, meta: IngestMeta): void`
  - `function getAllGames(db: Database.Database, sinceIso?: string): Array<Record<string, unknown>>` — each returned object is the full stored envelope (original payload fields plus `submittedBy` and `capturedAt` merged in).

- [ ] **Step 1: Scaffold the server sub-project**

```bash
mkdir -p server/ingest
cd server/ingest
pnpm init
pnpm pkg set type=module
pnpm pkg set scripts.start="tsx index.ts"
pnpm pkg set scripts.test="vitest run"
pnpm pkg set scripts.check="tsc --noEmit"
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3 @types/node tsx typescript vitest
```

- [ ] **Step 2: Write `server/ingest/tsconfig.json`**

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ES2022",
		"moduleResolution": "bundler",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"outDir": "dist",
		"types": ["node"]
	},
	"include": ["**/*.ts"]
}
```

- [ ] **Step 3: Write `server/ingest/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['**/*.test.ts']
	}
});
```

- [ ] **Step 4: Write the failing test — `server/ingest/db.test.ts`**

```ts
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
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd server/ingest && pnpm test`
Expected: FAIL — `db.ts` does not exist yet.

- [ ] **Step 6: Write `server/ingest/db.ts`**

```ts
import Database from 'better-sqlite3';

export interface PositionPayload {
	ply: number;
	color?: string;
	classificationName?: string;
	playedMove?: { moveLan?: string };
	difference?: number;
	caps2?: number;
	fen?: string;
	bestMove?: string;
	[key: string]: unknown;
}

export interface GamePayload {
	gameId: string;
	url: string;
	positions: PositionPayload[];
	tallies: Record<string, unknown>;
	analysisEngine?: string;
	book?: { code?: string };
	bookPly?: number;
	CAPS?: { white?: { all?: number }; black?: { all?: number } };
	reportCard?: { white?: { effectiveElo?: number }; black?: { effectiveElo?: number } };
	[key: string]: unknown;
}

export interface IngestMeta {
	submittedBy: string;
	capturedAt: string;
}

export function openDb(path: string): Database.Database {
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS games (
			game_id TEXT PRIMARY KEY,
			url TEXT NOT NULL,
			captured_at TEXT NOT NULL,
			submitted_by TEXT NOT NULL,
			analysis_engine TEXT,
			book_code TEXT,
			book_ply INTEGER,
			caps_white_all REAL,
			caps_black_all REAL,
			effective_elo_white INTEGER,
			effective_elo_black INTEGER,
			raw_json TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS positions (
			game_id TEXT NOT NULL REFERENCES games(game_id),
			ply INTEGER NOT NULL,
			color TEXT,
			classification_name TEXT,
			played_move_lan TEXT,
			difference REAL,
			caps2 REAL,
			fen TEXT,
			best_move TEXT,
			raw_json TEXT NOT NULL,
			PRIMARY KEY (game_id, ply)
		);
	`);
	return db;
}

export function upsertGame(db: Database.Database, payload: GamePayload, meta: IngestMeta): void {
	const envelope = { ...payload, submittedBy: meta.submittedBy, capturedAt: meta.capturedAt };

	const insertGame = db.prepare(`
		INSERT INTO games (
			game_id, url, captured_at, submitted_by, analysis_engine,
			book_code, book_ply, caps_white_all, caps_black_all,
			effective_elo_white, effective_elo_black, raw_json
		) VALUES (
			@gameId, @url, @capturedAt, @submittedBy, @analysisEngine,
			@bookCode, @bookPly, @capsWhiteAll, @capsBlackAll,
			@effectiveEloWhite, @effectiveEloBlack, @rawJson
		)
		ON CONFLICT(game_id) DO UPDATE SET
			url = excluded.url,
			captured_at = excluded.captured_at,
			submitted_by = excluded.submitted_by,
			analysis_engine = excluded.analysis_engine,
			book_code = excluded.book_code,
			book_ply = excluded.book_ply,
			caps_white_all = excluded.caps_white_all,
			caps_black_all = excluded.caps_black_all,
			effective_elo_white = excluded.effective_elo_white,
			effective_elo_black = excluded.effective_elo_black,
			raw_json = excluded.raw_json
	`);

	insertGame.run({
		gameId: payload.gameId,
		url: payload.url,
		capturedAt: meta.capturedAt,
		submittedBy: meta.submittedBy,
		analysisEngine: payload.analysisEngine ?? null,
		bookCode: payload.book?.code ?? null,
		bookPly: payload.bookPly ?? null,
		capsWhiteAll: payload.CAPS?.white?.all ?? null,
		capsBlackAll: payload.CAPS?.black?.all ?? null,
		effectiveEloWhite: payload.reportCard?.white?.effectiveElo ?? null,
		effectiveEloBlack: payload.reportCard?.black?.effectiveElo ?? null,
		rawJson: JSON.stringify(envelope)
	});

	db.prepare('DELETE FROM positions WHERE game_id = ?').run(payload.gameId);

	const insertPosition = db.prepare(`
		INSERT INTO positions (
			game_id, ply, color, classification_name, played_move_lan,
			difference, caps2, fen, best_move, raw_json
		) VALUES (
			@gameId, @ply, @color, @classificationName, @playedMoveLan,
			@difference, @caps2, @fen, @bestMove, @rawJson
		)
	`);

	for (const position of payload.positions) {
		insertPosition.run({
			gameId: payload.gameId,
			ply: position.ply,
			color: position.color ?? null,
			classificationName: position.classificationName ?? null,
			playedMoveLan: position.playedMove?.moveLan ?? null,
			difference: position.difference ?? null,
			caps2: position.caps2 ?? null,
			fen: position.fen ?? null,
			bestMove: position.bestMove ?? null,
			rawJson: JSON.stringify(position)
		});
	}
}

export function getAllGames(db: Database.Database, sinceIso?: string): Array<Record<string, unknown>> {
	const rows = sinceIso
		? db
				.prepare('SELECT raw_json FROM games WHERE captured_at >= ? ORDER BY captured_at ASC')
				.all(sinceIso)
		: db.prepare('SELECT raw_json FROM games ORDER BY captured_at ASC').all();
	return (rows as Array<{ raw_json: string }>).map((row) => JSON.parse(row.raw_json));
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd server/ingest && pnpm test`
Expected: PASS (3/3 tests)

- [ ] **Step 8: Commit**

```bash
git add server/ingest/package.json server/ingest/tsconfig.json server/ingest/vitest.config.ts server/ingest/db.ts server/ingest/db.test.ts server/ingest/pnpm-lock.yaml
git commit -m "feat(ingest-server): add SQLite schema and upsert/query db module"
```

---

### Task 2: Request validation module

**Files:**
- Create: `server/ingest/validate.ts`
- Test: `server/ingest/validate.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (for Task 3): `function validateIngestPayload(body: unknown): { ok: boolean; error?: string }` from `server/ingest/validate.ts`.

- [ ] **Step 1: Write the failing test — `server/ingest/validate.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server/ingest && pnpm test`
Expected: FAIL — `validate.ts` does not exist yet.

- [ ] **Step 3: Write `server/ingest/validate.ts`**

```ts
export interface ValidationResult {
	ok: boolean;
	error?: string;
}

export function validateIngestPayload(body: unknown): ValidationResult {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, error: 'body must be a JSON object' };
	}

	const payload = body as Record<string, unknown>;

	if (typeof payload.gameId !== 'string' || payload.gameId.length === 0) {
		return { ok: false, error: 'gameId is required and must be a non-empty string' };
	}
	if (typeof payload.url !== 'string' || payload.url.length === 0) {
		return { ok: false, error: 'url is required and must be a non-empty string' };
	}
	if (!Array.isArray(payload.positions)) {
		return { ok: false, error: 'positions is required and must be an array' };
	}
	if (typeof payload.tallies !== 'object' || payload.tallies === null) {
		return { ok: false, error: 'tallies is required and must be an object' };
	}

	return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server/ingest && pnpm test`
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/ingest/validate.ts server/ingest/validate.test.ts
git commit -m "feat(ingest-server): add loose request-shape validation"
```

---

### Task 3: HTTP server (routes) + integration tests

**Files:**
- Create: `server/ingest/server.ts`
- Test: `server/ingest/server.test.ts`

**Interfaces:**
- Consumes: `openDb`, `upsertGame`, `getAllGames`, `GamePayload` from `./db.js` (Task 1); `validateIngestPayload` from `./validate.js` (Task 2).
- Produces (for Task 4): `function createServer(config: { db: Database.Database; sharedToken: string }): http.Server` from `server/ingest/server.ts`. Routes: `POST /ingest` (requires header `x-ingest-token`, body is the raw payload JSON, `submittedBy`/`capturedAt` read from the body itself, defaulting to `'unknown'`/current time if absent), `GET /export` (requires header `x-ingest-token`, optional `?since=<ISO>` query param, responds `{ games: [...] }`).

- [ ] **Step 1: Write the failing test — `server/ingest/server.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server/ingest && pnpm test`
Expected: FAIL — `server.ts` does not exist yet.

- [ ] **Step 3: Write `server/ingest/server.ts`**

```ts
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

			upsertGame(config.db, payload, { submittedBy, capturedAt });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server/ingest && pnpm test`
Expected: PASS (3/3 tests in this file; 11/11 across the sub-project)

- [ ] **Step 5: Commit**

```bash
git add server/ingest/server.ts server/ingest/server.test.ts
git commit -m "feat(ingest-server): add POST /ingest and GET /export HTTP routes"
```

---

### Task 4: Entrypoint, Dockerfile, compose, and deployment README

**Files:**
- Create: `server/ingest/index.ts`
- Create: `server/ingest/Dockerfile`
- Create: `server/ingest/.dockerignore`
- Create: `server/ingest/docker-compose.yml`
- Create: `server/ingest/README.md`

**Interfaces:**
- Consumes: `openDb` from `./db.js` (Task 1), `createServer` from `./server.js` (Task 3).
- Produces: a runnable process/Docker image; no code interfaces consumed by later tasks.

- [ ] **Step 1: Write `server/ingest/index.ts`**

```ts
import { openDb } from './db.js';
import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? './data/calibration.sqlite';
const SHARED_TOKEN = process.env.INGEST_SHARED_TOKEN;

if (!SHARED_TOKEN) {
	console.error('INGEST_SHARED_TOKEN environment variable is required');
	process.exit(1);
}

const db = openDb(DB_PATH);
const server = createServer({ db, sharedToken: SHARED_TOKEN });

server.listen(PORT, () => {
	console.log(`Calibration ingest server listening on port ${PORT}`);
});
```

- [ ] **Step 2: Verify it starts locally**

```bash
cd server/ingest
mkdir -p data
INGEST_SHARED_TOKEN=local-dev-token pnpm start
```

Expected output: `Calibration ingest server listening on port 8787`. Stop with Ctrl+C.

- [ ] **Step 3: Write `server/ingest/Dockerfile`**

```dockerfile
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

ENV PORT=8787
ENV DB_PATH=/data/calibration.sqlite

EXPOSE 8787
VOLUME ["/data"]

CMD ["pnpm", "exec", "tsx", "index.ts"]
```

- [ ] **Step 4: Write `server/ingest/.dockerignore`**

```
node_modules
data
dist
*.sqlite
```

- [ ] **Step 5: Write `server/ingest/docker-compose.yml`**

```yaml
services:
  calibration-ingest:
    build: .
    ports:
      - '8787:8787'
    environment:
      - INGEST_SHARED_TOKEN=${INGEST_SHARED_TOKEN}
    volumes:
      - calibration-data:/data
    restart: unless-stopped

volumes:
  calibration-data:
```

- [ ] **Step 6: Verify the compose file is syntactically valid**

Run: `cd server/ingest && INGEST_SHARED_TOKEN=placeholder docker compose config`
Expected: prints the resolved compose configuration with no errors. (If Docker isn't available in this sandbox, note that in the task report as a manual step for the user.)

- [ ] **Step 7: Write `server/ingest/README.md`**

```markdown
# Calibration Ingest Server

Receives chess.com Game Review data captured by the SecondBoard Calibration
Capture browser extension (see `../extension/README.md`) and stores it in a
local SQLite file. Designed to run on a home LAN only — never expose this
to the public internet.

## Deploy with Docker Compose

1. Pick a long random shared secret, e.g. `openssl rand -hex 32`.
2. From this directory:

   ```bash
   INGEST_SHARED_TOKEN=<your-secret> docker compose up -d --build
   ```

3. The server listens on port `8787`. Data persists in the `calibration-data`
   Docker volume across restarts.
4. Give the extension's options page (on the contributor's machine) this
   server's LAN IP (e.g. `http://192.168.1.50:8787/ingest`) and the same
   shared secret.

## Endpoints

- `POST /ingest` — header `x-ingest-token: <shared-secret>`, JSON body is
  the captured `analyzeGame` payload. Upserts by `gameId`.
- `GET /export` — header `x-ingest-token: <shared-secret>`, optional
  `?since=<ISO-8601 timestamp>` query param. Returns `{ "games": [...] }`.

## Local development (without Docker)

```bash
pnpm install
mkdir -p data
INGEST_SHARED_TOKEN=local-dev-token pnpm start
```

## Pulling captured games onto your dev machine

```bash
curl -H "x-ingest-token: <shared-secret>" http://<home-server-ip>:8787/export > games-export.json
```

Wiring this into the project's own calibration scripts
(`scripts/calibration/calibrate.ts` etc.) is separate follow-up work, not
covered here.
```

- [ ] **Step 8: Commit**

```bash
git add server/ingest/index.ts server/ingest/Dockerfile server/ingest/.dockerignore server/ingest/docker-compose.yml server/ingest/README.md
git commit -m "feat(ingest-server): add entrypoint, Docker deployment, and README"
```

---

### Task 5: Extension scaffold + pure frame-parsing module

**Files:**
- Create: `extension/package.json`
- Create: `extension/vitest.config.ts`
- Create: `extension/src/parse-analyze-frame.js`
- Test: `extension/src/parse-analyze-frame.test.js`

**Interfaces:**
- Produces (for Task 8): `function parseAnalyzeGameMessage(rawMessageData: string): object | null` from `extension/src/parse-analyze-frame.js` — returns the `analyzeGame` frame's `data` object (which itself has `gameId: string` and `positions: array`) if the raw string is a valid `analyzeGame` WebSocket frame, else `null`.

- [ ] **Step 1: Scaffold the extension sub-project**

```bash
mkdir -p extension/src
cd extension
pnpm init
pnpm pkg set type=module
pnpm pkg set scripts.test="vitest run"
pnpm add -D vitest
```

- [ ] **Step 2: Write `extension/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.js']
	}
});
```

- [ ] **Step 3: Write the failing test — `extension/src/parse-analyze-frame.test.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd extension && pnpm test`
Expected: FAIL — `parse-analyze-frame.js` does not exist yet.

- [ ] **Step 5: Write `extension/src/parse-analyze-frame.js`**

```js
/**
 * Parses a raw WebSocket message string from chess.com's Game Review
 * connection. Returns the `analyzeGame` action's `data` object, or null if
 * the message isn't a recognized analyzeGame frame.
 * @param {string} rawMessageData
 * @returns {object | null}
 */
export function parseAnalyzeGameMessage(rawMessageData) {
	let parsed;
	try {
		parsed = JSON.parse(rawMessageData);
	} catch {
		return null;
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		parsed.action !== 'analyzeGame' ||
		typeof parsed.data !== 'object' ||
		parsed.data === null
	) {
		return null;
	}

	const data = parsed.data;
	if (typeof data.gameId !== 'string' || !Array.isArray(data.positions)) {
		return null;
	}

	return data;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd extension && pnpm test`
Expected: PASS (4/4 tests)

- [ ] **Step 7: Commit**

```bash
git add extension/package.json extension/vitest.config.ts extension/src/parse-analyze-frame.js extension/src/parse-analyze-frame.test.js extension/pnpm-lock.yaml
git commit -m "feat(extension): add pure analyzeGame frame parser"
```

---

### Task 6: Retry-queue pure module

**Files:**
- Create: `extension/src/retry-queue.js`
- Test: `extension/src/retry-queue.test.js`

**Interfaces:**
- Consumes: nothing from Task 5.
- Produces (for Task 8): `function enqueue(queue: object[], envelope: object): object[]` from `extension/src/retry-queue.js` — returns a new array with `envelope` appended, capped at 20 entries (drops the oldest when over capacity).

- [ ] **Step 1: Write the failing test — `extension/src/retry-queue.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { enqueue } from './retry-queue.js';

describe('enqueue', () => {
	it('appends to an empty queue', () => {
		expect(enqueue([], { id: 1 })).toEqual([{ id: 1 }]);
	});

	it('caps the queue at 20 entries, dropping the oldest', () => {
		const full = Array.from({ length: 20 }, (_, i) => ({ id: i }));
		const result = enqueue(full, { id: 20 });
		expect(result).toHaveLength(20);
		expect(result[0]).toEqual({ id: 1 });
		expect(result[19]).toEqual({ id: 20 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && pnpm test`
Expected: FAIL — `retry-queue.js` does not exist yet.

- [ ] **Step 3: Write `extension/src/retry-queue.js`**

```js
const MAX_QUEUE_SIZE = 20;

/**
 * Returns a new queue with `envelope` appended, capped at MAX_QUEUE_SIZE
 * (the oldest entries are dropped first when over capacity).
 * @param {Array<object>} queue
 * @param {object} envelope
 * @returns {Array<object>}
 */
export function enqueue(queue, envelope) {
	const next = [...queue, envelope];
	if (next.length > MAX_QUEUE_SIZE) {
		return next.slice(next.length - MAX_QUEUE_SIZE);
	}
	return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && pnpm test`
Expected: PASS (2/2 tests in this file; 6/6 across the sub-project)

- [ ] **Step 5: Commit**

```bash
git add extension/src/retry-queue.js extension/src/retry-queue.test.js
git commit -m "feat(extension): add capped retry-queue module"
```

---

### Task 7: Injected page script + content script (capture relay)

**Files:**
- Create: `extension/src/injected-page.js`
- Create: `extension/src/content-script.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (this task is glue with no unit-testable logic of its own; Task 8's `background.js` is what consumes Tasks 5–6's modules).
- Produces (for Task 8): the message relay contract — `injected-page.js` runs in the page's own JS context, wraps `window.WebSocket` so any message received on a connection whose URL includes `analysis.chess.com` is relayed via `window.postMessage({ source: 'secondboard-calibration-capture', rawMessageData: <raw string> }, '*')`. `content-script.js` (isolated world) listens for that `postMessage` and forwards it via `chrome.runtime.sendMessage({ type: 'raw-ws-message', rawMessageData: <raw string> })` — this exact message shape (`type: 'raw-ws-message'`, `rawMessageData`) is what Task 8's `background.js` listens for.

- [ ] **Step 1: Write `extension/src/injected-page.js`**

```js
(function () {
	const OriginalWebSocket = window.WebSocket;

	function ChessComCaptureSocket(url, protocols) {
		const socket =
			protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);

		if (typeof url === 'string' && url.includes('analysis.chess.com')) {
			socket.addEventListener('message', (event) => {
				window.postMessage(
					{ source: 'secondboard-calibration-capture', rawMessageData: event.data },
					'*'
				);
			});
		}

		return socket;
	}

	ChessComCaptureSocket.prototype = OriginalWebSocket.prototype;
	ChessComCaptureSocket.CONNECTING = OriginalWebSocket.CONNECTING;
	ChessComCaptureSocket.OPEN = OriginalWebSocket.OPEN;
	ChessComCaptureSocket.CLOSING = OriginalWebSocket.CLOSING;
	ChessComCaptureSocket.CLOSED = OriginalWebSocket.CLOSED;

	window.WebSocket = ChessComCaptureSocket;
})();
```

- [ ] **Step 2: Write `extension/src/content-script.js`**

```js
(function injectPageScript() {
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('src/injected-page.js');
	script.onload = () => script.remove();
	(document.head || document.documentElement).appendChild(script);
})();

window.addEventListener('message', (event) => {
	if (event.source !== window) return;
	if (!event.data || event.data.source !== 'secondboard-calibration-capture') return;
	chrome.runtime.sendMessage({ type: 'raw-ws-message', rawMessageData: event.data.rawMessageData });
});
```

- [ ] **Step 3: Syntax-check both files**

Run: `node --check extension/src/injected-page.js && node --check extension/src/content-script.js`
Expected: no output, exit code 0 (both files are syntactically valid; `chrome.*` calls are unresolved globals at this stage, which is expected — they only exist inside a real Chrome extension context, not in plain Node).

- [ ] **Step 4: Commit**

```bash
git add extension/src/injected-page.js extension/src/content-script.js
git commit -m "feat(extension): add WebSocket capture and content-script relay"
```

---

### Task 8: Background worker, options page, manifest, and manual verification

**Files:**
- Create: `extension/src/background.js`
- Create: `extension/src/options.html`
- Create: `extension/src/options.js`
- Create: `extension/manifest.json`
- Create: `extension/README.md`

**Interfaces:**
- Consumes: `parseAnalyzeGameMessage` from `./parse-analyze-frame.js` (Task 5), `enqueue` from `./retry-queue.js` (Task 6), and the `{ type: 'raw-ws-message', rawMessageData }` message contract from `content-script.js` (Task 7).
- Produces: a fully loadable Chrome extension; no further code interfaces.

- [ ] **Step 1: Write `extension/src/background.js`**

```js
import { parseAnalyzeGameMessage } from './parse-analyze-frame.js';
import { enqueue } from './retry-queue.js';

async function getConfig() {
	const stored = await chrome.storage.local.get(['ingestUrl', 'sharedToken', 'submittedBy']);
	return {
		ingestUrl: stored.ingestUrl ?? '',
		sharedToken: stored.sharedToken ?? '',
		submittedBy: stored.submittedBy ?? 'unknown'
	};
}

async function getQueue() {
	const stored = await chrome.storage.local.get(['retryQueue']);
	return stored.retryQueue ?? [];
}

async function setQueue(queue) {
	await chrome.storage.local.set({ retryQueue: queue });
}

async function sendEnvelope(config, envelope) {
	const response = await fetch(config.ingestUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-ingest-token': config.sharedToken },
		body: JSON.stringify(envelope)
	});
	if (!response.ok) {
		throw new Error(`ingest failed with status ${response.status}`);
	}
}

async function flushQueue() {
	const config = await getConfig();
	if (!config.ingestUrl) return;

	const queue = await getQueue();
	const remaining = [];
	for (const envelope of queue) {
		try {
			await sendEnvelope(config, envelope);
		} catch {
			remaining.push(envelope);
		}
	}
	await setQueue(remaining);
}

async function captureAndSend(analyzeGameData) {
	const config = await getConfig();
	if (!config.ingestUrl) return;

	const envelope = {
		...analyzeGameData,
		submittedBy: config.submittedBy,
		capturedAt: new Date().toISOString()
	};

	try {
		await sendEnvelope(config, envelope);
	} catch {
		const queue = await getQueue();
		await setQueue(enqueue(queue, envelope));
	}
}

chrome.runtime.onMessage.addListener((message) => {
	if (message?.type !== 'raw-ws-message') return;
	const analyzeGameData = parseAnalyzeGameMessage(message.rawMessageData);
	if (analyzeGameData) {
		captureAndSend(analyzeGameData);
	}
});

chrome.runtime.onStartup.addListener(flushQueue);
chrome.runtime.onInstalled.addListener(flushQueue);
```

- [ ] **Step 2: Write `extension/src/options.html`**

```html
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>SecondBoard Calibration Capture</title>
	</head>
	<body>
		<h1>SecondBoard Calibration Capture</h1>
		<form id="config-form">
			<label>
				Ingest server URL
				<input type="text" id="ingestUrl" placeholder="http://192.168.1.50:8787/ingest" />
			</label>
			<br />
			<label>
				Shared token
				<input type="text" id="sharedToken" />
			</label>
			<br />
			<label>
				Submitted by
				<input type="text" id="submittedBy" placeholder="brother" />
			</label>
			<br />
			<button type="submit">Save</button>
		</form>
		<p id="status"></p>
		<script src="options.js"></script>
	</body>
</html>
```

- [ ] **Step 3: Write `extension/src/options.js`**

```js
async function loadConfig() {
	const stored = await chrome.storage.local.get(['ingestUrl', 'sharedToken', 'submittedBy']);
	document.getElementById('ingestUrl').value = stored.ingestUrl ?? '';
	document.getElementById('sharedToken').value = stored.sharedToken ?? '';
	document.getElementById('submittedBy').value = stored.submittedBy ?? '';
}

document.getElementById('config-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const ingestUrl = document.getElementById('ingestUrl').value.trim();
	const sharedToken = document.getElementById('sharedToken').value.trim();
	const submittedBy = document.getElementById('submittedBy').value.trim();

	await chrome.storage.local.set({ ingestUrl, sharedToken, submittedBy });
	document.getElementById('status').textContent = 'Saved.';
});

loadConfig();
```

- [ ] **Step 4: Write `extension/manifest.json`**

```json
{
	"manifest_version": 3,
	"name": "SecondBoard Calibration Capture",
	"version": "0.1.0",
	"description": "Forwards chess.com Game Review analysis data to a personal calibration server.",
	"permissions": ["storage"],
	"host_permissions": ["https://www.chess.com/*"],
	"background": {
		"service_worker": "src/background.js",
		"type": "module"
	},
	"content_scripts": [
		{
			"matches": ["https://www.chess.com/*"],
			"js": ["src/content-script.js"],
			"run_at": "document_start"
		}
	],
	"web_accessible_resources": [
		{
			"resources": ["src/injected-page.js"],
			"matches": ["https://www.chess.com/*"]
		}
	],
	"options_page": "src/options.html"
}
```

- [ ] **Step 5: Write `extension/README.md`**

```markdown
# SecondBoard Calibration Capture (browser extension)

Automatically forwards chess.com Game Review results to a personal
calibration server on your home network. Install once, then forget about
it — every Game Review you run afterward is captured with no extra steps.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select this `extension/` folder.
4. Click "Details" on the newly installed extension, then "Extension
   options."
5. Fill in:
   - **Ingest server URL**: e.g. `http://192.168.1.50:8787/ingest`
     (ask whoever set up the server for this).
   - **Shared token**: the secret they gave you.
   - **Submitted by**: your name, e.g. `brother`.
6. Click Save. That's it — nothing else to do.

## What it does

Whenever you finish a Game Review on chess.com, this extension notices and
sends the analysis results to the configured server. It never touches your
chess.com login, password, or session — only the game analysis data itself.

## Troubleshooting

If captures aren't showing up, re-open the extension's options page and
double-check the server URL and token are correct, and that your computer
can reach the server (same Wi-Fi/network).
```

- [ ] **Step 6: Manual verification (deferred to the user — no headless browser in this environment)**

Document in the task report, for the user to confirm on their own machine:
1. Load the extension unpacked in Chrome per the README above.
2. Configure the options page pointing at a running instance of
   `server/ingest` (see Task 4's README for how to start it locally).
3. Open a real chess.com Game Review and let it finish.
4. Confirm (via the server's logs, or `GET /export`) that the game shows up.

- [ ] **Step 7: Commit**

```bash
git add extension/src/background.js extension/src/options.html extension/src/options.js extension/manifest.json extension/README.md
git commit -m "feat(extension): add background worker, options page, and manifest"
```

---

### Task 9: Whole-pipeline verification and top-level docs

**Files:**
- Modify: `README.md` (root)

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: nothing consumed by further tasks (final task).

- [ ] **Step 1: Add a short section to the root `README.md`**

Find a sensible existing section break in `README.md` (e.g. near any existing "Development"/"Calibration" heading) and add:

```markdown
## Calibration data collection

Two independent, self-contained sub-projects support collecting more
chess.com Game Review ground truth for calibration:

- `server/ingest/` — a small Node + SQLite server for receiving captured
  games on your home LAN. See `server/ingest/README.md`.
- `extension/` — a Chrome extension that auto-captures Game Review results
  and sends them to the ingest server. See `extension/README.md`.

Neither shares tooling or dependencies with the main SvelteKit/Tauri app;
each has its own `package.json` and test suite.
```

- [ ] **Step 2: Run each sub-project's checks**

```bash
cd server/ingest && pnpm test && pnpm exec tsc --noEmit
cd ../../extension && pnpm test
```

Expected: all pass (11/11 in `server/ingest`, 6/6 in `extension`; if
`better-sqlite3` failed to compile in this sandbox per the Global
Constraints note, report that explicitly instead of a fabricated pass).

- [ ] **Step 3: Confirm the root app is unaffected**

```bash
cd /home/jonas/Documents/Code/SecondBoard
pnpm exec vitest run
git status --short
```

Expected: the root suite's pass count is unchanged from before this plan
(363/363 as of the last recorded run), and `git status` shows only the new
`server/ingest/`, `extension/`, and the `README.md` edit — nothing else
modified.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: point to the new calibration capture pipeline (ingest server + extension)"
```
