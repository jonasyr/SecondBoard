import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AccuracyBlock from './AccuracyBlock.svelte';

describe('AccuracyBlock', () => {
	it('renders both players with their accuracy and game rating', () => {
		const { getByText } = render(AccuracyBlock);
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('DominikP')).toBeTruthy();
		expect(getByText('82.6')).toBeTruthy();
		expect(getByText('89.1')).toBeTruthy();
		expect(getByText('1712')).toBeTruthy();
		expect(getByText('1994')).toBeTruthy();
	});
});
