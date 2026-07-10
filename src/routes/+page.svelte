<script lang="ts">
	import type { Screen } from '$lib/types';
	import { appState } from '$lib/stores/app-state.svelte';

	const SCREEN_LABELS: Record<Exclude<Screen, 'review'>, string> = {
		home: 'Dashboard',
		openings: 'Opening Explorer',
		insights: 'Insights & Weakness Timeline',
		training: 'Training',
		games: 'Games',
		sessions: 'Sessions',
		stats: 'Stats',
		settings: 'Settings'
	};

	const screenLabel = $derived(
		appState.screen === 'review'
			? appState.gameLoaded
				? 'Game Review'
				: 'Onboarding · Paste PGN'
			: SCREEN_LABELS[appState.screen]
	);
</script>

<div class="screen-placeholder">
	{screenLabel} — scaffold OK
</div>

<style>
	.screen-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
</style>
