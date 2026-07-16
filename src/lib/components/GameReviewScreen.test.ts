import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GameReviewScreen from './GameReviewScreen.svelte';
import { appState } from '$lib/stores/app-state.svelte';
import { SAN_LIST } from '$lib/game/mock-data';

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
		isSample: true
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
