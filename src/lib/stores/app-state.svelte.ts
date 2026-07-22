import type { Move } from '$lib/board/types';
import type { Screen, Tab, ClassCode } from '$lib/types';
import type { Wdl } from '$lib/game/accuracy';
import { EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
import { parsePgn } from '$lib/api/pgn';
import { classifyGame } from '$lib/game/classify';
import { findBookDepth } from '$lib/game/book';
import { SAMPLE_PGN } from '$lib/game/sample-pgn';
import type { GameData } from '$lib/game/review';

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
	classCodes: ClassCode[];
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
	game: GameData | null;
	parseError: string | null;
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
	classCodes: [],
	wdlPerPly: [],
	secondEvalPerPly: [],
	secondWdlPerPly: [],
	analysisStatus: 'idle',
	game: null,
	parseError: null
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

export function getMaxPly(): number {
	return appState.game ? appState.game.sanList.length : 0;
}

export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(getMaxPly(), ply));
}

export function stepPly(delta: number): void {
	goToPly(appState.ply + delta);
}

/** Parses the pasted/typed PGN (or the built-in sample if blank) via the real
 * Rust pgn module, replacing the mock SAN engine (LOGIC.md §7/§8). */
export async function startReview(): Promise<void> {
	const pgnToParse = appState.pgnText.trim() || SAMPLE_PGN;
	try {
		const parsed = await parsePgn(pgnToParse);
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim(),
			whiteName: parsed.whiteName,
			blackName: parsed.blackName,
			whiteRating: parsed.whiteRating,
			blackRating: parsed.blackRating,
			result: parsed.result ?? null
		};
		appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
		appState.bestMoves = {};
		appState.classCodes = [];
		appState.wdlPerPly = [];
		appState.secondEvalPerPly = [];
		appState.secondWdlPerPly = [];
		appState.analysisStatus = 'idle';
		appState.parseError = null;
		appState.gameLoaded = true;
		appState.screen = 'review';
		appState.ply = parsed.sanList.length;
		appState.tab = 'analysis';
		void refreshRealAnalysis();
	} catch (err) {
		appState.parseError =
			typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to parse PGN.';
	}
}

/** Fires the Phase-0 engine spike (LOGIC.md §7): replaces the seeded mock
 * evalPerPly/bestMoves with real Stockfish output once analysis completes. */
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly } =
			await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.secondEvalPerPly = secondEvalPerPly;
		appState.secondWdlPerPly = secondWdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly,
			bookPlyDepth: findBookDepth(appState.game!.sanList)
		});
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
