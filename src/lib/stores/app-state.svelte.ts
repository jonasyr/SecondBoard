import type { Screen, Tab } from '$lib/types';

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
	selfAnalysis: false
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
