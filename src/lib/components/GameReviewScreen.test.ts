import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GameReviewScreen from './GameReviewScreen.svelte';
import { appState } from '$lib/stores/app-state.svelte';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

// Self-contained fixture: real sample SAN list (31 plies, still legitimate mock
// content in mock-data.ts) paired with placeholder positions/moveMeta — this
// screen-level test only asserts on board square count and player names, not on
// real chess position content.
const positions = Array.from({ length: SAN_LIST.length + 1 }, () => ({}));
const moveMeta = Array.from({ length: SAN_LIST.length }, () => ({ from: 'a2', to: 'a3' }));

beforeEach(() => {
	appState.screen = 'review';
	appState.gameLoaded = true;
	appState.ply = 31;
	appState.flipped = false;
	appState.tab = 'analysis';
	appState.game = {
		sanList: SAN_LIST,
		positions,
		moveMeta,
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: null
	};
});

describe('GameReviewScreen', () => {
	it('renders the board, both player rows, and the review panel', () => {
		const { container, getByText } = render(GameReviewScreen);
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('DominikP')).toBeTruthy();
		expect(getByText('Game Review')).toBeTruthy();
	});

	it('renders DominikP on top and Jonas on bottom when unflipped', () => {
		const { container } = render(GameReviewScreen);
		const rows = container.querySelectorAll('.player-row');
		expect(rows[0].textContent).toContain('DominikP');
		expect(rows[1].textContent).toContain('Jonas');
	});

	it('clicking New PGN resets to onboarding', async () => {
		const { getByText } = render(GameReviewScreen);
		await fireEvent.click(getByText('New PGN'));
		expect(appState.gameLoaded).toBe(false);
	});

	it('ArrowRight/ArrowLeft step the ply while the screen is review', async () => {
		render(GameReviewScreen);
		appState.ply = 5;
		await fireEvent.keyDown(window, { key: 'ArrowRight' });
		expect(appState.ply).toBe(6);
		await fireEvent.keyDown(window, { key: 'ArrowLeft' });
		expect(appState.ply).toBe(5);
	});
});
