import { describe, it, expect } from 'vitest';
import { createAppState } from './app-state.svelte';

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
