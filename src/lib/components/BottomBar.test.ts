import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BottomBar from './BottomBar.svelte';
import { EVAL_PER_PLY } from '$lib/game/mock-data';

describe('BottomBar', () => {
	it('renders the eval graph at height 62 and the nav controls', () => {
		const { container } = render(BottomBar, {
			props: {
				ply: 0,
				evalPerPly: EVAL_PER_PLY,
				classCodes: [],
				onFirst: () => {},
				onPrev: () => {},
				onNext: () => {},
				onLast: () => {}
			}
		});
		expect(container.querySelector('svg')?.getAttribute('height')).toBe('62');
		expect(container.querySelectorAll('button')).toHaveLength(5);
	});

	it('shows a centered analyzing overlay over the blurred graph when analyzing is true', () => {
		const { getByText, container } = render(BottomBar, {
			props: {
				ply: 0,
				evalPerPly: EVAL_PER_PLY,
				classCodes: [],
				onFirst: () => {},
				onPrev: () => {},
				onNext: () => {},
				onLast: () => {},
				analyzing: true
			}
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(true);
	});

	it('shows no analyzing overlay by default', () => {
		const { queryByText, container } = render(BottomBar, {
			props: {
				ply: 0,
				evalPerPly: EVAL_PER_PLY,
				classCodes: [],
				onFirst: () => {},
				onPrev: () => {},
				onNext: () => {},
				onLast: () => {}
			}
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(false);
	});
});
