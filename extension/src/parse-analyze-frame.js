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
