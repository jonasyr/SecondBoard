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

// better-sqlite3 can only bind numbers, strings, bigints, buffers, and null.
// Real chess.com payload fields (e.g. difference, bookPly) aren't validated
// beyond the few fields validate.ts checks, so a boolean/array/object here
// would otherwise crash the insert instead of just losing that one field.
function toBindable(value: unknown): number | string | bigint | Buffer | null {
	if (value === undefined || value === null) return null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint' || Buffer.isBuffer(value)) {
		return value;
	}
	return JSON.stringify(value);
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
		gameId: toBindable(payload.gameId),
		url: toBindable(payload.url),
		capturedAt: toBindable(meta.capturedAt),
		submittedBy: toBindable(meta.submittedBy),
		analysisEngine: toBindable(payload.analysisEngine),
		bookCode: toBindable(payload.book?.code),
		bookPly: toBindable(payload.bookPly),
		capsWhiteAll: toBindable(payload.CAPS?.white?.all),
		capsBlackAll: toBindable(payload.CAPS?.black?.all),
		effectiveEloWhite: toBindable(payload.reportCard?.white?.effectiveElo),
		effectiveEloBlack: toBindable(payload.reportCard?.black?.effectiveElo),
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
			gameId: toBindable(payload.gameId),
			ply: toBindable(position.ply),
			color: toBindable(position.color),
			classificationName: toBindable(position.classificationName),
			playedMoveLan: toBindable(position.playedMove?.moveLan),
			difference: toBindable(position.difference),
			caps2: toBindable(position.caps2),
			fen: toBindable(position.fen),
			bestMove: toBindable(position.bestMove),
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
