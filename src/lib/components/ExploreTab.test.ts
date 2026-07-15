import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ExploreTab from './ExploreTab.svelte';

describe('ExploreTab', () => {
	it('renders the win-rate stat and calls onOpenOpenings when clicked', async () => {
		const onOpenOpenings = vi.fn();
		const { getByText } = render(ExploreTab, { props: { onOpenOpenings } });
		expect(getByText('61%')).toBeTruthy();
		await fireEvent.click(getByText('Open in Opening Explorer'));
		expect(onOpenOpenings).toHaveBeenCalledOnce();
	});
});
