/**
 * Parses a raw WebSocket message string from chess.com's Game Review
 * connection. Returns the `analyzeGame` action's `data` object with
 * `metaData` stripped -- it can carry a live session token in
 * `metaData.clientRequest.source.token`, which must never leave the
 * browser -- or null if the message isn't a recognized analyzeGame frame.
 * gameId/url are NOT read from this payload (the real payload has neither);
 * see build-envelope.js, which derives them from the page URL instead.
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

	if (!Array.isArray(parsed.data.positions)) {
		return null;
	}

	const safeData = { ...parsed.data };
	delete safeData.metaData;
	return safeData;
}

/**
 * Parses the client's OUTGOING `gameAnalysis` request frame (the one that
 * kicks off analysis) and returns its `pgn`, or null if this isn't that
 * frame. The `analyzeGame` response frame this pairs with doesn't carry the
 * PGN itself, so it must be captured separately from the request.
 * @param {string} rawMessageData
 * @returns {string | null}
 */
export function parseGameAnalysisRequest(rawMessageData) {
	let parsed;
	try {
		parsed = JSON.parse(rawMessageData);
	} catch {
		return null;
	}

	if (typeof parsed !== 'object' || parsed === null || parsed.action !== 'gameAnalysis') {
		return null;
	}

	const pgn = parsed.game?.pgn;
	return typeof pgn === 'string' ? pgn : null;
}
