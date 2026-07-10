import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SidebarSyncCard from './SidebarSyncCard.svelte';

describe('SidebarSyncCard', () => {
	it('renders the sync status and stats from README §6.1', () => {
		const { getByText } = render(SidebarSyncCard);
		expect(getByText('Chess.com sync')).toBeTruthy();
		expect(getByText('Synced')).toBeTruthy();
		expect(getByText('247 games indexed')).toBeTruthy();
		expect(getByText('2m ago')).toBeTruthy();
	});
});
