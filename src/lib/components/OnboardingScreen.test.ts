import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

const { parsePgn } = vi.hoisted(() => ({ parsePgn: vi.fn() }));
vi.mock('$lib/api/pgn', () => ({ parsePgn }));

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

import OnboardingScreen from './OnboardingScreen.svelte';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.gameLoaded = false;
	appState.pgnText = '';
	appState.screen = 'review';

	parsePgn.mockResolvedValue({
		sanList: Array.from({ length: 31 }, (_, i) => `move${i}`),
		positions: Array.from({ length: 32 }, () => ({})),
		moves: Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }))
	});
	loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });
});

describe('OnboardingScreen', () => {
	it('renders the heading, textarea, and CTA buttons', () => {
		const { getByText, container } = render(OnboardingScreen);
		expect(getByText('Review your chess game')).toBeTruthy();
		expect(container.querySelector('textarea')).not.toBeNull();
		expect(getByText('Start Review')).toBeTruthy();
		expect(getByText('Upload .pgn')).toBeTruthy();
	});

	it('"Paste sample game" fills the textarea with the sample PGN', async () => {
		const { getByText, container } = render(OnboardingScreen);
		await fireEvent.click(getByText('Paste sample game'));
		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		expect(textarea.value).toContain('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');
		expect(appState.pgnText).toContain('[Event "Live Rapid"]');
	});

	it('"Start Review" loads the game regardless of textarea contents', async () => {
		const { getByText } = render(OnboardingScreen);
		await fireEvent.click(getByText('Start Review'));
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(31);
	});
});
