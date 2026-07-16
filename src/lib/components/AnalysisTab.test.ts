import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnalysisTab from './AnalysisTab.svelte';
import { appState } from '$lib/stores/app-state.svelte';
import { SAN_LIST } from '$lib/game/mock-data';

// Self-contained fixture: real sample SAN list (still legitimate mock content in
// mock-data.ts) paired with placeholder positions/moveMeta — these tests assert
// on the coach card's move label/text and move-list row count derived from
// sanList, not on real chess position content.
const positions = Array.from({ length: SAN_LIST.length + 1 }, () => ({}));
const moveMeta = Array.from({ length: SAN_LIST.length }, () => ({ from: 'a2', to: 'a3' }));

beforeEach(() => {
	appState.game = {
		sanList: SAN_LIST,
		positions,
		moveMeta,
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
