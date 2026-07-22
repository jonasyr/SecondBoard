// Usage: pnpm exec vite-node scripts/calibration/extract-fixture.ts <har-file> <slug>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extractGameAnalysis, buildFixture } from '../../src/lib/calibration/har-extract';

const [, , harPath, slug] = process.argv;
if (!harPath || !slug) {
	console.error('Usage: vite-node scripts/calibration/extract-fixture.ts <har-file> <slug>');
	process.exit(1);
}

const har = JSON.parse(readFileSync(harPath, 'utf-8'));
const extracted = extractGameAnalysis(har);
if (!extracted) {
	console.error(
		'No analyzeGame data found in this HAR -- was the Game Review panel left open long enough to fully load?'
	);
	process.exit(1);
}

const liveGameEntry = har.log.entries.find((e: { request: { url: string } }) =>
	e.request.url.includes('/game/live/')
);
const gameId = liveGameEntry
	? (new URL(liveGameEntry.request.url).pathname.split('/').pop() ?? 'unknown')
	: 'unknown';

const fixture = buildFixture(extracted, {
	url: `https://www.chess.com/game/live/${gameId}`,
	gameId,
	capturedAt: new Date().toISOString()
});

mkdirSync('docs/references/calibration-games', { recursive: true });
writeFileSync(`docs/references/calibration-games/${slug}.json`, JSON.stringify(fixture, null, 2));
console.log(`Wrote docs/references/calibration-games/${slug}.json (${fixture.positions.length} positions)`);
