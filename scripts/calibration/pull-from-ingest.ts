// Usage: pnpm exec vite-node scripts/calibration/pull-from-ingest.ts <ingest-base-url> <shared-token> [since-iso]
//
// Fetches captured games from the calibration ingest server's GET /export
// and writes each one to docs/references/calibration-games/<gameId>.json in
// the same CalibrationFixture shape scripts/calibration/extract-fixture.ts
// produces, so calibrate.ts/sweep.ts can consume either source
// interchangeably. Games captured before the extension started attaching a
// `pgn` (see extension/src/build-envelope.js) are skipped, since calibrate.ts
// requires it to replay the game.
import { writeFileSync, mkdirSync } from 'node:fs';

const [, , baseUrl, token, since] = process.argv;
if (!baseUrl || !token) {
	console.error(
		'Usage: vite-node scripts/calibration/pull-from-ingest.ts <ingest-base-url> <shared-token> [since-iso]'
	);
	process.exit(1);
}

interface ExportedGame {
	gameId: string;
	url: string;
	capturedAt: string;
	pgn?: string | null;
	[key: string]: unknown;
}

async function main() {
	const exportUrl = new URL('/export', baseUrl);
	if (since) exportUrl.searchParams.set('since', since);

	const response = await fetch(exportUrl, { headers: { 'x-ingest-token': token } });
	if (!response.ok) {
		console.error(`GET /export failed with status ${response.status}: ${await response.text()}`);
		process.exit(1);
	}

	const { games } = (await response.json()) as { games: ExportedGame[] };
	mkdirSync('docs/references/calibration-games', { recursive: true });

	let written = 0;
	let skipped = 0;
	for (const game of games) {
		if (!game.pgn) {
			console.warn(`Skipping ${game.gameId}: no pgn captured (captured before the pgn-capture fix)`);
			skipped++;
			continue;
		}
		writeFileSync(
			`docs/references/calibration-games/${game.gameId}.json`,
			JSON.stringify(game, null, 2)
		);
		written++;
	}

	console.log(`Wrote ${written} fixture(s), skipped ${skipped} (missing pgn).`);
}

main();
