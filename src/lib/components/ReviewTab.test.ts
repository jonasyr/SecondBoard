import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';

describe('ReviewTab', () => {
	it('renders the eval graph, accuracy block, breakdown, and phase table together', () => {
		const { container, getByText } = render(ReviewTab, { props: { ply: 31 } });
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});
});
