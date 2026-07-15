import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DetailsTab from './DetailsTab.svelte';

describe('DetailsTab', () => {
	it('renders the key-value details list', () => {
		const { getByText } = render(DetailsTab);
		expect(getByText('Event')).toBeTruthy();
		expect(getByText('Chess.com · Live Rapid')).toBeTruthy();
		expect(getByText('10 + 0')).toBeTruthy();
		expect(getByText('Italian Game · C50')).toBeTruthy();
		expect(getByText('Locally · 100%')).toBeTruthy();
	});
});
