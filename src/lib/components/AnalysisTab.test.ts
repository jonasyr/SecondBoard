import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnalysisTab from './AnalysisTab.svelte';
import { appState } from '$lib/stores/app-state.svelte';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

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
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: null
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

	it('at ply 0 shows the intro coach text with no classification badge', () => {
		const { container } = render(AnalysisTab, {
			props: { ply: 0, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(container.textContent).toContain('Start');
		expect(container.textContent).not.toContain('a book move');
		expect(container.querySelector('.coach-slot .badge')).toBeNull();
	});

	it('never shows an analyzing note itself even while analysisStatus is loading (that lives on the eval graph in BottomBar now)', () => {
		appState.analysisStatus = 'loading';
		const { queryByText } = render(AnalysisTab, {
			props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
	});
});
