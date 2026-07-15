import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PhaseTable from './PhaseTable.svelte';

describe('PhaseTable', () => {
	it('renders 3 phase rows with a badge per side', () => {
		const { container, getByText } = render(PhaseTable);
		expect(container.querySelectorAll('.row')).toHaveLength(3);
		expect(getByText('Opening')).toBeTruthy();
		expect(getByText('Middlegame')).toBeTruthy();
		expect(getByText('Endgame')).toBeTruthy();
	});
});
