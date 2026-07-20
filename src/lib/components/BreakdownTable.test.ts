import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { BreakdownRow } from '$lib/game/breakdown';
import BreakdownTable from './BreakdownTable.svelte';

describe('BreakdownTable', () => {
	it('renders the supplied white and black classification counts', () => {
		const rows: BreakdownRow[] = [
			['best', 7, 9],
			['blunder', 2, 4]
		];
		const { container, getByText } = render(BreakdownTable, { props: { rows } });

		expect(container.querySelectorAll('.row')).toHaveLength(2);
		expect(getByText('7')).toBeTruthy();
		expect(getByText('9')).toBeTruthy();
		expect(getByText('2')).toBeTruthy();
		expect(getByText('4')).toBeTruthy();
	});
});
