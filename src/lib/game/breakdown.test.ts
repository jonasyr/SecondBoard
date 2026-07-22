import { describe, expect, it } from 'vitest';
import { getBreakdownRows } from './breakdown';

describe('getBreakdownRows', () => {
	it('counts classifications by alternating white and black plies', () => {
		const rows = getBreakdownRows(['best', 'best', 'mistake', 'best']);

		expect(rows).toHaveLength(10);
		expect(rows.find(([code]) => code === 'best')).toEqual(['best', 1, 2]);
		expect(rows.find(([code]) => code === 'mistake')).toEqual(['mistake', 1, 0]);
	});

	it('returns zero counts for absent classifications and empty analysis', () => {
		const rows = getBreakdownRows([]);

		expect(rows.find(([code]) => code === 'brilliant')).toEqual(['brilliant', 0, 0]);
		expect(rows.find(([code]) => code === 'great')).toEqual(['great', 0, 0]);
		expect(rows.find(([code]) => code === 'book')).toEqual(['book', 0, 0]);
		expect(rows.find(([code]) => code === 'miss')).toEqual(['miss', 0, 0]);
	});
});
