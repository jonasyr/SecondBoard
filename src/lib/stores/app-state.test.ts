import { describe, it, expect, beforeEach } from 'vitest';
import { createAppState } from './app-state.svelte';
import { appState, MAX_PLY, goToPly, stepPly, startReview, newGame, handleReviewKeydown } from './app-state.svelte';

describe('createAppState', () => {
	it('returns the exact default state from LOGIC.md §1', () => {
		const state = createAppState();
		expect(state.screen).toBe('review');
		expect(state.ply).toBe(31);
		expect(state.tab).toBe('analysis');
		expect(state.flipped).toBe(false);
		expect(state.sidebarCollapsed).toBe(false);
		expect(state.gameLoaded).toBe(false);
		expect(state.pgnText).toBe('');
		expect(state.showLines).toBe(true);
		expect(state.selfAnalysis).toBe(false);
	});
});

describe('screen/ply transitions', () => {
	beforeEach(() => {
		appState.screen = 'review';
		appState.ply = 31;
		appState.gameLoaded = true;
		appState.tab = 'analysis';
		appState.pgnText = 'x';
	});

	it('MAX_PLY matches the mock game length (31)', () => {
		expect(MAX_PLY).toBe(31);
	});

	it('goToPly clamps to [0, MAX_PLY]', () => {
		goToPly(-5);
		expect(appState.ply).toBe(0);
		goToPly(999);
		expect(appState.ply).toBe(31);
		goToPly(10);
		expect(appState.ply).toBe(10);
	});

	it('stepPly moves by delta and clamps', () => {
		appState.ply = 0;
		stepPly(-1);
		expect(appState.ply).toBe(0);
		stepPly(1);
		expect(appState.ply).toBe(1);
	});

	it('startReview resets to the default review state regardless of pgnText', () => {
		appState.gameLoaded = false;
		appState.ply = 0;
		appState.tab = 'details';
		startReview();
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(31);
		expect(appState.tab).toBe('analysis');
	});

	it('newGame resets to onboarding', () => {
		newGame();
		expect(appState.gameLoaded).toBe(false);
		expect(appState.pgnText).toBe('');
		expect(appState.screen).toBe('review');
	});

	it('handleReviewKeydown steps ply on ArrowLeft/ArrowRight only on the review screen', () => {
		appState.ply = 5;
		const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
		handleReviewKeydown(right);
		expect(appState.ply).toBe(6);
		expect(right.defaultPrevented).toBe(true);

		appState.screen = 'home';
		const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
		handleReviewKeydown(left);
		expect(appState.ply).toBe(6); // unchanged — guarded on screen
	});
});
