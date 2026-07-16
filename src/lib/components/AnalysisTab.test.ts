import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnalysisTab from './AnalysisTab.svelte';
import { appState } from '$lib/stores/app-state.svelte';
import { SAMPLE_SAN_LIST_EXPORT, SAMPLE_POSITIONS, SAMPLE_MOVE_META } from '$lib/game/mock-data';

beforeEach(() => {
	appState.game = {
		sanList: SAMPLE_SAN_LIST_EXPORT,
		positions: SAMPLE_POSITIONS,
		moveMeta: SAMPLE_MOVE_META,
		isSample: true
	};
});

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

	it('shows the analyzing note only while analysisStatus is loading', () => {
		appState.analysisStatus = 'loading';
		const { getByText, unmount } = render(AnalysisTab, {
			props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		unmount();

		appState.analysisStatus = 'ready';
		const { queryByText } = render(AnalysisTab, {
			props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
	});
});
