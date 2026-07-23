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
	for (const position of payload.positions) {
		if (
			typeof position !== 'object' ||
			position === null ||
			typeof (position as Record<string, unknown>).ply !== 'number'
		) {
			return { ok: false, error: 'each position must be an object with a numeric ply' };
		}
	}
	if (typeof payload.tallies !== 'object' || payload.tallies === null) {
		return { ok: false, error: 'tallies is required and must be an object' };
	}

	return { ok: true };
}
