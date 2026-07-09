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

export function createAppState(): AppState {
	return { ...defaultState };
}

export const appState = $state(defaultState);
