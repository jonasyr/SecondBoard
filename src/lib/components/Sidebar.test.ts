import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';
import { appState, createAppState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	Object.assign(appState, createAppState());
});

describe('Sidebar', () => {
	it('renders the brand name and all 9 nav items', () => {
		const { getByText, getByTitle } = render(Sidebar);
		expect(getByText('SecondBoard')).toBeTruthy();
		expect(getByText('Chess Review Lab')).toBeTruthy();
		expect(getByTitle('Home')).toBeTruthy();
		expect(getByTitle('Game Review')).toBeTruthy();
		expect(getByTitle('Settings')).toBeTruthy();
	});

	it('clicking a nav item updates appState.screen', async () => {
		const { getByTitle } = render(Sidebar);
		await fireEvent.click(getByTitle('Openings'));
		expect(appState.screen).toBe('openings');
	});

	it('marks the nav item matching appState.screen as active', () => {
		appState.screen = 'insights';
		const { getByTitle } = render(Sidebar);
		expect(getByTitle('Insights').classList.contains('active')).toBe(true);
		expect(getByTitle('Home').classList.contains('active')).toBe(false);
	});

	it('clicking the collapse toggle flips appState.sidebarCollapsed', async () => {
		const { getByTitle } = render(Sidebar);
		expect(appState.sidebarCollapsed).toBe(false);
		await fireEvent.click(getByTitle('Toggle sidebar'));
		expect(appState.sidebarCollapsed).toBe(true);
	});

	it('shows the Chess.com sync card when expanded and hides it when collapsed', () => {
		const expanded = render(Sidebar);
		expect(expanded.getByText('Chess.com sync')).toBeTruthy();
		expanded.unmount();

		appState.sidebarCollapsed = true;
		const collapsed = render(Sidebar);
		expect(collapsed.queryByText('Chess.com sync')).toBeNull();
	});

	it('always renders the profile row', () => {
		const { getByText } = render(Sidebar);
		expect(getByText('Jonas')).toBeTruthy();
	});
});
