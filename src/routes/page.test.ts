import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { appState, createAppState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	Object.assign(appState, createAppState());
});

describe('root page (screen-switcher placeholder)', () => {
	it('shows the Onboarding placeholder by default (screen=review, gameLoaded=false)', () => {
		const { getByText } = render(Page);
		expect(getByText('Onboarding · Paste PGN — scaffold OK')).toBeTruthy();
	});

	it('renders the Board QA harness instead of a placeholder once a game is loaded on review', () => {
		appState.gameLoaded = true;
		const { queryByText, container } = render(Page);
		expect(queryByText('Game Review — scaffold OK')).toBeNull();
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});

	it('shows the Dashboard placeholder for the home screen', () => {
		appState.screen = 'home';
		const { getByText } = render(Page);
		expect(getByText('Dashboard — scaffold OK')).toBeTruthy();
	});

	it('shows the Opening Explorer placeholder for the openings screen', () => {
		appState.screen = 'openings';
		const { getByText } = render(Page);
		expect(getByText('Opening Explorer — scaffold OK')).toBeTruthy();
	});

	it('renders the temporary Board QA harness (64 squares) when a game is loaded on the review screen', () => {
		appState.gameLoaded = true;
		appState.screen = 'review';
		const { container } = render(Page);
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});
});
