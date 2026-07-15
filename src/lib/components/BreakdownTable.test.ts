import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BreakdownTable from './BreakdownTable.svelte';

describe('BreakdownTable', () => {
	it('renders 10 category rows with white/black counts', () => {
		const { container, getByText } = render(BreakdownTable);
		expect(container.querySelectorAll('.row')).toHaveLength(10);
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('22')).toBeTruthy(); // best/white
	});
});
