import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';
import { EVAL_PER_PLY } from '$lib/game/mock-data';

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

	it('shows no analyzing note by default', () => {
		const { queryByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
	});

	it('shows an analyzing note when analyzing is true', () => {
		const { getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, analyzing: true }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
	});
});
