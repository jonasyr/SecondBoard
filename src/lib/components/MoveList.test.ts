import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly: () => {} } });
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly } });
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — SAN_LIST has 31 plies
	});
});
