// One-time build step: downloads the lichess-org/chess-openings TSV files
// (MIT-licensed, the same dataset lichess's own site uses) and writes a
// single frozen JSON asset. SecondBoard does not fetch this at runtime --
// re-run this script by hand only if the upstream dataset needs refreshing.
import { writeFileSync } from 'node:fs';

const FILES = ['a', 'b', 'c', 'd', 'e'];
const BASE_URL = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

function parseTsv(text) {
	const lines = text.trim().split('\n');
	const [header, ...rows] = lines;
	const columns = header.split('\t');
	return rows.map((line) => {
		const cells = line.split('\t');
		const row = Object.fromEntries(columns.map((col, i) => [col, cells[i]]));
		return {
			eco: row.eco,
			name: row.name,
			// The pgn column is numbered SAN, e.g. "1. e4 e5 2. Nf3" -- strip the
			// move-number tokens ("1.", "2.", ...), keep the SAN moves only.
			sanMoves: row.pgn.split(' ').filter((token) => !/^\d+\.+$/.test(token))
		};
	});
}

async function main() {
	const openings = [];
	for (const file of FILES) {
		const res = await fetch(`${BASE_URL}/${file}.tsv`);
		if (!res.ok) throw new Error(`failed to fetch ${file}.tsv: ${res.status}`);
		const text = await res.text();
		openings.push(...parseTsv(text));
	}
	writeFileSync(
		new URL('../../src/lib/data/openings.json', import.meta.url),
		JSON.stringify(openings)
	);
	console.log(`Wrote ${openings.length} openings to src/lib/data/openings.json`);
}

main();
