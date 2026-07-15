import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnalysisTab from './AnalysisTab.svelte';

describe('AnalysisTab', () => {
	it('renders the coach card for the given ply and the move list', () => {
		const { getByText, container } = render(AnalysisTab, {
			props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(getByText('16. Ne5')).toBeTruthy();
		expect(
			container.querySelector('[data-sb-movelist="1"]')!.querySelectorAll('.row')
		).toHaveLength(16);
	});

	it('calls onNext when the Next button is clicked', async () => {
		const onNext = vi.fn();
		const { getByText } = render(AnalysisTab, {
			props: { ply: 0, onSelectPly: () => {}, onNext }
		});
		await fireEvent.click(getByText('Next'));
		expect(onNext).toHaveBeenCalledOnce();
	});

	it('at ply 0 falls back to the book classification for the coach card', () => {
		const { container } = render(AnalysisTab, {
			props: { ply: 0, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(container.textContent).toContain('Start');
		expect(container.textContent).toContain('a book move');
	});
});
