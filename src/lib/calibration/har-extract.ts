import type { CalibrationFixture, CalibrationPosition } from './types';

interface HarWebSocketMessage {
	type: 'send' | 'receive';
	data: string;
}
interface HarEntry {
	request: { url: string };
	_webSocketMessages?: HarWebSocketMessage[];
}
interface HarLog {
	log: { entries: HarEntry[] };
}

export interface ExtractedGameAnalysis {
	pgn: string;
	data: Record<string, unknown>;
}

/**
 * Locates chess.com's real game-analysis WebSocket entry
 * (`wss://analysis.chess.com/...`) in a captured HAR and returns the PGN
 * sent in the client's outgoing `gameAnalysis` frame together with the
 * parsed `data` object of the server's terminal `analyzeGame` frame. Returns
 * null when either piece is missing (e.g. a HAR captured before the Game
 * Review panel finished loading, so the `analyzeGame` frame never arrived).
 */
export function extractGameAnalysis(har: HarLog): ExtractedGameAnalysis | null {
	const wsEntry = har.log.entries.find((entry) =>
		entry.request.url.startsWith('wss://analysis.chess.com/')
	);
	if (!wsEntry?._webSocketMessages) return null;

	let pgn: string | null = null;
	let data: Record<string, unknown> | null = null;

	for (const message of wsEntry._webSocketMessages) {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(message.data);
		} catch {
			continue;
		}
		if (message.type === 'send' && parsed.action === 'gameAnalysis') {
			const game = parsed.game as Record<string, unknown> | undefined;
			if (typeof game?.pgn === 'string') pgn = game.pgn;
		}
		if (message.type === 'receive' && parsed.action === 'analyzeGame') {
			data = parsed.data as Record<string, unknown>;
		}
	}

	if (!pgn || !data) return null;
	return { pgn, data };
}

export interface FixtureMeta {
	url: string;
	gameId: string;
	capturedAt: string;
}

/**
 * Builds a `CalibrationFixture` from the raw `analyzeGame` data object,
 * keeping only the fields the diff engine needs.
 */
export function buildFixture(
	extracted: ExtractedGameAnalysis,
	meta: FixtureMeta
): CalibrationFixture {
	const rawPositions = extracted.data.positions as Array<Record<string, unknown>>;
	const positions: CalibrationPosition[] = rawPositions.map((pos, ply) => {
		const playedMove = pos.playedMove as Record<string, unknown> | null | undefined;
		return {
			ply,
			color: (pos.color as 'white' | 'black' | null) ?? null,
			classificationName: (pos.classificationName as string | null) ?? null,
			playedMoveLan: (playedMove?.moveLan as string | undefined) ?? null,
			difference: (pos.difference as number | null) ?? null,
			caps2: (pos.caps2 as number | null) ?? null
		};
	});

	return {
		url: meta.url,
		gameId: meta.gameId,
		capturedAt: meta.capturedAt,
		pgn: extracted.pgn,
		analysisEngine: (extracted.data.analysisEngine as string) ?? 'unknown',
		book: (extracted.data.book as CalibrationFixture['book']) ?? null,
		bookPly: (extracted.data.bookPly as number | undefined) ?? null,
		tallies: extracted.data.tallies as CalibrationFixture['tallies'],
		positions
	};
}
