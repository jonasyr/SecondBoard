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
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});

	it('shows the real winner (from game.result) in the accuracy block, not a hardcoded one', () => {
		const { getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(getByText('0–1')).toBeTruthy();
	});

	it('shows no analyzing overlay by default', () => {
		const { queryByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(false);
	});

	it('shows a centered analyzing overlay over the blurred graph when analyzing is true', () => {
		const { getByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, analyzing: true }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(true);
	});
});
