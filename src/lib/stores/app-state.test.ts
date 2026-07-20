import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

const { parsePgn } = vi.hoisted(() => ({ parsePgn: vi.fn() }));
vi.mock('$lib/api/pgn', () => ({ parsePgn }));

import { createAppState } from './app-state.svelte';
import {
	appState,
	getMaxPly,
	goToPly,
	stepPly,
	startReview,
	newGame,
	handleReviewKeydown
} from './app-state.svelte';

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

	it('getMaxPly returns 0 before any game is loaded, and the real length after startReview', async () => {
		expect(getMaxPly()).toBe(0);

		parsePgn.mockResolvedValue({
			sanList: Array.from({ length: 31 }, (_, i) => `move${i}`),
			positions: Array.from({ length: 32 }, () => ({})),
			moves: Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }))
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(getMaxPly()).toBe(31);
	});

	it('goToPly clamps to [0, MAX_PLY]', () => {
		goToPly(-5);
		expect(appState.ply).toBe(0);
		goToPly(999);
		expect(appState.ply).toBe(getMaxPly());
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

	it('startReview resets to the default review state regardless of pgnText', async () => {
		appState.gameLoaded = false;
		appState.ply = 0;
		appState.tab = 'details';
		parsePgn.mockResolvedValue({
			sanList: Array.from({ length: 31 }, (_, i) => `move${i}`),
			positions: Array.from({ length: 32 }, () => ({})),
			moves: Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }))
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

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

describe('startReview (real PGN parsing)', () => {
	beforeEach(() => {
		parsePgn.mockReset();
		loadRealAnalysis.mockReset();
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });
	});

	it('on successful parse: populates game, resets parseError, and loads the review screen', async () => {
		appState.pgnText = '1. e4 e5';
		appState.parseError = 'stale error from a previous attempt';
		parsePgn.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{}, {}, {}],
			moves: [
				{ from: 'e2', to: 'e4' },
				{ from: 'e7', to: 'e5' }
			]
		});

		await startReview();

		expect(parsePgn).toHaveBeenCalledWith('1. e4 e5');
		expect(appState.parseError).toBeNull();
		expect(appState.game?.sanList).toEqual(['e4', 'e5']);
		expect(appState.game?.isSample).toBe(false);
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(2);
		expect(appState.evalPerPly).toEqual([0, 0, 0]);
		expect(appState.classCodes).toEqual([]); // reset on every fresh parse, before real analysis lands
	});

	it('falls back to the sample PGN when pgnText is blank, and flags isSample true', async () => {
		appState.pgnText = '   ';
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		await startReview();

		const { SAMPLE_PGN } = await import('$lib/game/sample-pgn');
		expect(parsePgn).toHaveBeenCalledWith(SAMPLE_PGN);
		expect(appState.game?.isSample).toBe(true);
	});

	it('on parse failure: sets parseError and does not load the review screen', async () => {
		appState.pgnText = 'not a real pgn';
		appState.gameLoaded = false;
		parsePgn.mockRejectedValue(new Error('illegal move'));

		await startReview();

		expect(appState.parseError).toBe('illegal move');
		expect(appState.gameLoaded).toBe(false);
	});

	it('on parse failure with a plain-string rejection (Tauri v2 invoke behavior): surfaces the exact string', async () => {
		appState.pgnText = 'not a real pgn';
		appState.gameLoaded = false;
		parsePgn.mockRejectedValue('illegal move: Kd8');

		await startReview();

		expect(appState.parseError).toBe('illegal move: Kd8');
		expect(appState.gameLoaded).toBe(false);
	});

	it('threads the parsed Result tag into game.result', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }],
			result: '1-0'
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBe('1-0');
	});

	it('defaults game.result to null when the PGN has no Result tag', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBeNull();
	});
});

describe('real analysis loading', () => {
	beforeEach(() => {
		parsePgn.mockReset();
		loadRealAnalysis.mockReset();
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});
	});

	it('starts in the idle status by default', () => {
		const state = createAppState();
		expect(state.analysisStatus).toBe('idle');
		expect(state.evalPerPly.length).toBeGreaterThan(0);
	});

	it('goes loading -> ready and applies the real data once startReview resolves', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.analysisStatus).toBe('loading');

		resolveAnalysis({ evalPerPly: [0, 0.3], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('ready');
		expect(appState.evalPerPly).toEqual([0, 0.3]);
	});

	it('populates classCodes from the real evalPerPly once analysis is ready', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.classCodes).toEqual([]); // nothing computed yet while loading

		resolveAnalysis({ evalPerPly: [0, 1], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.classCodes).toEqual(['best']);
	});

	it('leaves classCodes empty (not fabricated) when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		await startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
		expect(appState.classCodes).toEqual([]);
	});

	it('goes loading -> error when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		await startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
	});
});
