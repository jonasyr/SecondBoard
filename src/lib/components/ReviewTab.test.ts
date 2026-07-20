import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';
import { EVAL_PER_PLY } from '$lib/game/mock-data';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.game = {
		sanList: ['e4'],
		positions: [{}, {}],
		moveMeta: [{ from: 'e2', to: 'e4' }],
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: '0-1'
	};
});

describe('ReviewTab', () => {
	it('renders the eval graph, accuracy block, breakdown, and phase table together', () => {
		const { container, getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, classCodes: [], wdlPerPly: [] }
		});
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});

	it('shows the real winner (from game.result) in the accuracy block, not a hardcoded one', () => {
		const { getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, classCodes: [], wdlPerPly: [] }
		});
		expect(getByText('0–1')).toBeTruthy();
	});

	it('shows no analyzing overlay by default', () => {
		const { queryByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, classCodes: [], wdlPerPly: [] }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(false);
	});

	it('shows a centered analyzing overlay over the blurred graph when analyzing is true', () => {
		const { getByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, classCodes: [], wdlPerPly: [], analyzing: true }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(true);
	});

	it('does not show a fabricated 100.0 accuracy while analysis is not ready, even when evalPerPly is a full-length placeholder of zeros', () => {
		appState.analysisStatus = 'loading';
		const { container, queryByText } = render(ReviewTab, {
			props: { ply: 1, evalPerPly: new Array(2).fill(0), classCodes: [], wdlPerPly: [] }
		});
		expect(queryByText('100.0')).toBeNull();
		const chips = container.querySelectorAll('.accuracy-grid .chip.sbmono');
		expect(chips.length).toBe(2);
		chips.forEach((chip) => expect(chip.textContent?.trim()).toBe('—'));
	});

	it('gates wdlPerPly on analysisStatus === ready, same as evalPerPly, so no fabricated accuracy uses stale wdl', () => {
		appState.analysisStatus = 'loading';
		const { container } = render(ReviewTab, {
			props: { ply: 1, evalPerPly: new Array(2).fill(0), classCodes: [], wdlPerPly: [[500, 400, 100], null] }
		});
		const chips = container.querySelectorAll('.accuracy-grid .chip.sbmono');
		expect(chips.length).toBe(2);
		chips.forEach((chip) => expect(chip.textContent?.trim()).toBe('—'));
		appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
	});
});
