import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { PhaseRow } from '$lib/game/phase';
import PhaseTable from './PhaseTable.svelte';

describe('PhaseTable', () => {
	it('renders 3 phase rows with a badge per side when accuracy data is present', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.2 }, black: { code: 'good', accuracy: 81.4 } },
			{ name: 'Middlegame', white: { code: 'good', accuracy: 79.9 }, black: { code: 'inaccuracy', accuracy: 62.1 } },
			{ name: 'Endgame', white: { code: 'best', accuracy: 95.0 }, black: { code: 'best', accuracy: 91.3 } }
		];
		const { container, getByText } = render(PhaseTable, { props: { rows } });

		expect(container.querySelectorAll('.row')).toHaveLength(3);
		expect(getByText('Opening')).toBeTruthy();
		expect(getByText('Middlegame')).toBeTruthy();
		expect(getByText('Endgame')).toBeTruthy();
	});

	it('shows a dash placeholder instead of a badge for a phase with no accuracy data', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 100 }, black: { code: 'best', accuracy: 100 } },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { getAllByText } = render(PhaseTable, { props: { rows } });
		expect(getAllByText('—')).toHaveLength(4);
	});

	it('sets an exact-accuracy tooltip on each present badge', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.25 }, black: null },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { container } = render(PhaseTable, { props: { rows } });
		const tooltip = container.querySelector('[title*="98.3"]');
		expect(tooltip).toBeTruthy();
	});
});
