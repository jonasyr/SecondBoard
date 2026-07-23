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
