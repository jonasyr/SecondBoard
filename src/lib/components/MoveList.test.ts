import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';
import type { ClassCode } from '$lib/types';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const sanList = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];
const classCodes: ClassCode[] = Array(31).fill('best');

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly, sanList, classCodes }
		});
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — sanList has 31 plies
	});

	it('does not show a classification badge for a ply with no classCodes entry (analysis not ready)', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(0);
	});

	it('shows a classification badge for every ply that has a real classCodes entry', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: ['excellent', 'blunder'] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(2);
	});

	it('still highlights the selected cell when classCodes is empty', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 1, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		const selected = container.querySelector('[data-sb-sel="1"]') as HTMLElement;
		expect(selected).not.toBeNull();
		expect(selected.getAttribute('style')).toContain('background: rgba(45, 224, 206, 0.14)');
	});

	it('highlights a selected classified move with its official classification color', () => {
		const { container } = render(MoveList, {
			props: {
				selectedPly: 1,
				onSelectPly: () => {},
				sanList: ['e4', 'e5'],
				classCodes: ['mistake', 'best']
			}
		});
		const selected = container.querySelector('[data-sb-sel="1"]') as HTMLElement;
		const style = selected.getAttribute('style')!;
		expect(style).toContain('background: rgba(229, 143, 42, 0.14)');
		expect(style).toContain('color: rgb(229, 143, 42)');
		expect(style).toContain('box-shadow: inset 0 0 0 1px #e58f2a4d');
	});
});
