/**
 * Extracts a chess.com game id from a page URL (the last run of 5+ digits
 * in the URL), or null if none is found.
 * @param {string} pageUrl
 * @returns {string | null}
 */
export function extractGameId(pageUrl) {
	const matches = pageUrl.match(/\d{5,}/g);
	return matches ? matches[matches.length - 1] : null;
}

/**
 * Builds the envelope to send to the ingest server from a parsed
 * analyzeGame data object (already stripped of metaData by
 * parseAnalyzeGameMessage), the page URL it was captured on, and submitter
 * config. Assigns `ply` to each position by its array index, matching this
 * project's existing calibration-fixture convention
 * (src/lib/calibration/har-extract.ts).
 * @param {object} analyzeGameData
 * @param {string} pageUrl
 * @param {{ submittedBy: string }} config
 * @param {string | null} [pgn] the PGN captured from the preceding outgoing
 *   `gameAnalysis` request frame (see parse-analyze-frame.js), if any
 * @returns {object}
 */
export function buildEnvelope(analyzeGameData, pageUrl, config, pgn = null) {
	const positions = (analyzeGameData.positions ?? []).map((position, ply) => ({
		...position,
		ply
	}));

	return {
		...analyzeGameData,
		positions,
		gameId: extractGameId(pageUrl),
		url: pageUrl,
		submittedBy: config.submittedBy,
		capturedAt: new Date().toISOString(),
		pgn
	};
}
