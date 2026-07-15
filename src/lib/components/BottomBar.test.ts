import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BottomBar from './BottomBar.svelte';

describe('BottomBar', () => {
	it('renders the eval graph at height 62 and the nav controls', () => {
		const { container } = render(BottomBar, {
			props: { ply: 0, onFirst: () => {}, onPrev: () => {}, onNext: () => {}, onLast: () => {} }
		});
		expect(container.querySelector('svg')?.getAttribute('height')).toBe('62');
		expect(container.querySelectorAll('button')).toHaveLength(5);
	});
});
