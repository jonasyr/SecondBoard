import type { ClassCode } from '$lib/types';

export type BreakdownRow = [ClassCode, number, number];

const BREAKDOWN_ORDER: ClassCode[] = [
	'brilliant',
	'great',
	'best',
	'excellent',
	'good',
	'book',
	'forced',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
];

export function getBreakdownRows(classCodes: ClassCode[]): BreakdownRow[] {
	const rows = BREAKDOWN_ORDER.map<BreakdownRow>((code) => [code, 0, 0]);
	const rowsByCode = new Map(rows.map((row) => [row[0], row]));

	classCodes.forEach((code, index) => {
		const row = rowsByCode.get(code)!;
		row[index % 2 === 0 ? 1 : 2] += 1;
	});

	return rows;
}
