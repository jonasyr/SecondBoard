import type { Move } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST, EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';

export interface AppState {
	screen: Screen;
	ply: number;
	tab: Tab;
	flipped: boolean;
	sidebarCollapsed: boolean;
	gameLoaded: boolean;
	pgnText: string;
	showLines: boolean;
	selfAnalysis: boolean;
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
}

const defaultState: AppState = {
	screen: 'review',
	ply: 31,
	tab: 'analysis',
	flipped: false,
	sidebarCollapsed: false,
	gameLoaded: false,
	pgnText: '',
	showLines: true,
	selfAnalysis: false,
	evalPerPly: [...EVAL_PER_PLY],
	bestMoves: { ...BEST_MOVES },
	analysisStatus: 'idle'
};

/**
 * Creates a non-reactive snapshot of the default application state.
 * This function is primarily used for testing default values.
 *
 * Note: Application code should import and use the module-level `appState` export
 * instead, which is the reactive singleton that tracks state changes.
 *
 * @returns A plain object copy of the default state (not reactive)
 */
export function createAppState(): AppState {
	return { ...defaultState };
}

/** The reactive singleton store that tracks application state. Consumers should import and use this export. */
export const appState = $state(defaultState);

export const MAX_PLY = SAN_LIST.length;

export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(MAX_PLY, ply));
}

export function stepPly(delta: number): void {
	goToPly(appState.ply + delta);
}

/** Reference `startReview` handler: always loads the same mock game — pgnText is cosmetic (Global Constraints). */
export function startReview(): void {
	appState.gameLoaded = true;
	appState.screen = 'review';
	appState.ply = MAX_PLY;
	appState.tab = 'analysis';
	void refreshRealAnalysis();
}

/** Fires the Phase-0 engine spike (LOGIC.md §7): replaces the seeded mock
 * evalPerPly/bestMoves with real Stockfish output once analysis completes. */
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves } = await loadRealAnalysis();
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}

export function newGame(): void {
	appState.gameLoaded = false;
	appState.pgnText = '';
	appState.screen = 'review';
}

/** LOGIC.md §1 keyboard rule: guarded on screen==='review' only (not gameLoaded). */
export function handleReviewKeydown(e: KeyboardEvent): void {
	if (appState.screen !== 'review') return;
	if (e.key === 'ArrowLeft') {
		e.preventDefault();
		stepPly(-1);
	} else if (e.key === 'ArrowRight') {
		e.preventDefault();
		stepPly(1);
	}
}
