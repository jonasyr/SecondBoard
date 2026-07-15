import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

const { animateSlide } = vi.hoisted(() => ({ animateSlide: vi.fn() }));
vi.mock('$lib/board/animate-slide', () => ({ animateSlide }));

import Board from './Board.svelte';
import type { Position } from '$lib/board/types';

const POS_0: Position = { e2: ['P', 'w'] };
const POS_1: Position = { e4: ['P', 'w'] };
const POS_FAR: Position = { e4: ['P', 'w'], d5: ['P', 'b'] };

beforeEach(() => {
	animateSlide.mockClear();
});

describe('Board', () => {
	it('renders exactly 64 squares', () => {
		const { container } = render(Board, { props: { position: {}, ply: 0 } });
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});

	it('renders unflipped by default (first square a8) and flips when flipped=true', () => {
		const { container: unflipped } = render(Board, { props: { position: {}, ply: 0 } });
		expect(unflipped.querySelectorAll('[data-sq]')[0].getAttribute('data-sq')).toBe('a8');

		const { container: flipped } = render(Board, {
			props: { position: {}, ply: 0, flipped: true }
		});
		expect(flipped.querySelectorAll('[data-sq]')[0].getAttribute('data-sq')).toBe('h1');
	});

	it("renders the classification badge on the last move's destination square", () => {
		const { container } = render(Board, {
			props: { position: POS_1, ply: 1, lastMove: { from: 'e2', to: 'e4' }, classCode: 'best' }
		});
		const dest = container.querySelector('[data-sq="e4"]')!;
		expect(dest.querySelector('.badge')).not.toBeNull();
	});

	it('renders the best-move arrow only when the classification is a NOT_BEST code and a best move is given', () => {
		const { container: withArrow } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'mistake',
				best: { from: 'g8', to: 'f6', san: 'Nf6' }
			}
		});
		expect(withArrow.querySelector('svg.arrow-overlay')).not.toBeNull();

		const { container: noArrowBestMove } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'best',
				best: null
			}
		});
		expect(noArrowBestMove.querySelector('svg.arrow-overlay')).toBeNull();

		const { container: noArrowGoodClass } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'excellent',
				best: { from: 'g8', to: 'f6', san: 'Nf6' }
			}
		});
		expect(noArrowGoodClass.querySelector('svg.arrow-overlay')).toBeNull();
	});

	it('triggers the slide animation on a single-step ply change with the same flip state', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_1, ply: 1, flipped: false });
		await tick();
		expect(animateSlide).toHaveBeenCalledTimes(1);
		expect(animateSlide).toHaveBeenCalledWith(expect.anything(), 'e2', 'e4');
	});

	it('does not trigger the slide animation on a multi-step ply jump', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_FAR, ply: 5, flipped: false });
		await tick();
		expect(animateSlide).not.toHaveBeenCalled();
	});

	it('does not trigger the slide animation when flipped changes alongside a single-step ply change', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_1, ply: 1, flipped: true });
		await tick();
		expect(animateSlide).not.toHaveBeenCalled();
	});
});
