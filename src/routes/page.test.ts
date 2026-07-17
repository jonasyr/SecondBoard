import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { appState, createAppState } from '$lib/stores/app-state.svelte';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

beforeEach(() => {
	Object.assign(appState, createAppState());
});

// Self-contained fixture: real sample SAN list (still legitimate mock content in
// mock-data.ts) paired with placeholder positions/moveMeta — this route-level
// test only asserts on board square count and screen-switch text, not on real
// chess position content.
function loadSampleGame(): void {
	appState.game = {
		sanList: SAN_LIST,
		positions: Array.from({ length: SAN_LIST.length + 1 }, () => ({})),
		moveMeta: Array.from({ length: SAN_LIST.length }, () => ({ from: 'a2', to: 'a3' })),
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: null
	};
}

describe('root page (screen switcher)', () => {
	it('shows the OnboardingScreen by default (screen=review, gameLoaded=false)', () => {
		const { getByText } = render(Page);
		expect(getByText('Review your chess game')).toBeTruthy();
	});

	it('renders the GameReviewScreen board instead of onboarding once a game is loaded on review', () => {
		appState.gameLoaded = true;
		loadSampleGame();
		const { queryByText, container } = render(Page);
		expect(queryByText('Review your chess game')).toBeNull();
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

	it('renders the GameReviewScreen (64 board squares) when a game is loaded on the review screen', () => {
		appState.gameLoaded = true;
		appState.screen = 'review';
		loadSampleGame();
		const { container } = render(Page);
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});
});
